import { DateTime } from 'luxon'
import axios from 'axios'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
const db = new PrismaClient()

export async function getCities() {

  let excludeCities = await db.sendResult.findMany({select: { city_id: true }})
  excludeCities = excludeCities.map(item => item.city_id)

  const otr = await db.otr.findMany({ where: { geoID: { notIn: excludeCities}}})

  return otr.reduce((acc, item) => {

    if (acc[item.geoID]) {
      acc[item.geoID].tvIDs.push(item.tvID)
    } else {
      acc[item.geoID] = { timeshift: item.mh_city_id_timeshift, tvIDs: [item.tvID] }
    }

    return acc
  }, {})
}

export async function  makeCityData ({cityId, day, tvIDs, timeshift}) {
  // TODO брать данные из файла, если они уже есть
  const dayEnd = DateTime.fromSQL(day, { setZone: true }).endOf('day').toSQL({includeOffset: false})
  const sql = `SELECT b.num_key, a.sTimeMsk, a.dur
                 FROM stat_y2021m02_geo${cityId} a
                          JOIN num_keys b ON b.num = a.num
                 WHERE 1 AND sTimeMsk BETWEEN '${day}' AND '${dayEnd}' AND tvID IN (${tvIDs});`

  try {

    const rawMinutes = await db.$queryRawUnsafe(sql)
    const minutes = cityMinutes({ rawMinutes, cityId, timeshift })

    const cityData = []
    for (const [minuteBeginning, data] of Object.entries(minutes)) {
      cityData.push({minuteBeginning, ...data })
    }
    return cityData

  } catch (e) {
    return null
    // console.warn(e.meta?.message, e.message)
  }
}

export function cityMinutes ({ rawMinutes, cityId, timeshift }) {
  return rawMinutes.reduce((acc, rawMinute) => {
    const timeMsk = DateTime.fromISO(rawMinute.sTimeMsk, { setZone: true }).setZone('UTC+3', { keepLocalTime: true })
    const minutes = Math.floor((timeMsk.second + rawMinute.dur) / 60)

    for (let i = 0; i <= minutes; i++) {
      const minuteBeginning = timeMsk.plus({ minutes: i }).startOf('minute')
      const minuteBeginningString = minuteBeginning.toISO()

      if (acc[minuteBeginningString]) {
        acc[minuteBeginningString].mc_keys.push(rawMinute.num_key)
      } else {
        acc[minuteBeginningString] = { geoID: cityId, minuteBeginningLocal: minuteBeginning.plus({ hours: timeshift }).toISO(), mc_keys: [rawMinute.num_key] }
      }
    }

    return acc

  }, {})
}

export  async function sendData(data) {
  try {
    const response = await axios.post('https://noob.mediahills.ru/', data, {headers: {Authorization: 'xxxxxxx'}})
    return response.status === 200
    // console.log(response)
  } catch(e) {
    return false
    // console.log(e)
  }

}

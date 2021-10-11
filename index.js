// import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import { writeFile } from 'fs/promises'
import pkg from '@prisma/client'
import { DateTime } from 'luxon'
import { getCities, makeCityData, sendData} from './functions.js'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
// TODO принимать дату из параметров запуска
const day = '2021-02-01 00:00:00'
const cities = await getCities()

for (const cityId in cities) {
  const cityData = await makeCityData({cityId, day, tvIDs: cities[cityId].tvIDs, timeshift: cities[cityId].timeshift})
  if (cityData) {
    await writeFile(`city${cityId}_${day}.json`, JSON.stringify(cityData));
    let sendDone = false

    // TODO отправлять данные асинхронно
    while (!sendDone) {
      console.log('send attempt')
      sendDone = await sendData(cityData)
      if (sendDone) await prisma.sendResult.create({data: {city_id: parseInt(cityId), date: DateTime.fromSQL(day).toISO()}})
    }
    console.log(`city sent: ${cityId}`)
  }

}

await prisma.sendResult.deleteMany()



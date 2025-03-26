// import puppeteer from "puppeteer";
// const express = require('express');
// const bodyParser = require('body-parser');
import { Cluster } from 'puppeteer-cluster'
import express from 'express'

import axios from 'axios'
import puppeteer from 'puppeteer'
import { Telegraf } from 'telegraf'
import { humanizeText } from './humanize.js'

import { connect } from 'puppeteer-real-browser'
import fetch from 'node-fetch'

if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

async function searchFlights(departureDate, returnDate, passengerData) {
  const url = `https://aviata.kz/aviax/search/ALA-LON${departureDate}LON-ALA${returnDate}1000E`

  const browserConfig = {
    headless: false,
    args: [],
    customConfig: {},
    turnstile: true,
    connectOption: {},
    disableXvfb: false,
    ignoreAllFlags: false,
    // Uncomment and configure the proxy settings if needed
    // proxy: {
    //     host: '<proxy-host>',
    //     port: '<proxy-port>',
    //     username: '<proxy-username>',
    //     password: '<proxy-password>'
    // }
  }

  const { browser, page } = await connect(browserConfig)

  try {
    await page.goto(url)
    console.log(`Opened search page for ${departureDate} - ${returnDate}`)

    await page.waitForSelector('button.ui-btn.--primary')
    const firstOfferButton = await page.$('button.ui-btn.--primary')

    if (firstOfferButton) {
      await firstOfferButton.click()
      console.log('First offer selected successfully.')
    } else {
      console.log('First offer not found.')
    }

    await page.waitForSelector('button.ui-btn.--primary.w-50.h-12.rounded-md.text-lg.font-bold')
    const selectButton = await page.$('button.ui-btn.--primary.w-50.h-12.rounded-md.text-lg.font-bold')

    if (selectButton) {
      await selectButton.click()
      console.log('Select button clicked successfully.')
    } else {
      console.log('Select button not found.')
    }

    await page.waitForSelector('input[name="passengers[ADT-0][lastName]"]')
    await page.type('input[name="passengers[ADT-0][lastName]"]', passengerData.lastName)
    await page.type('input[name="passengers[ADT-0][firstName]"]', passengerData.firstName)
    await page.click(`input[value="${passengerData.gender}"]`)
    await page.type('input[name="passengers[ADT-0][dob]"]', passengerData.dob)
    await page.type('input[name="passengers[ADT-0][documentNumber]"]', passengerData.documentNumber)
    await page.type('input[name="passengers[ADT-0][expiresAt]"]', passengerData.expiresAt)
    await page.type('input[name="passengers[ADT-0][iin]"]', passengerData.iin)
    await page.type('input[name="contacts[email]"]', passengerData.email)
    await page.type('input[name="contacts[phone]"]', passengerData.phone)

    await page.waitForSelector('#btnBook')
    await page.click('#btnBook')

    const buttonSelector = '.ui-btn.--md.--secondary.w-full.rounded-sm.font-bold'

    try {
      const button = await page.waitForSelector(buttonSelector, { timeout: 3000 })

      if (button) {
        console.log('Button found! Clicking...')
        await button.click()
      } else {
        console.log('Button not found.')
      }
    } catch (error) {
      console.log('Button not found or an error occurred:', error.message)
    }
  } catch (error) {
    console.error('Error navigating to the URL:', error)
  } finally {
    await browser.close()
  }
}

// Example function call

class Tour {
  constructor(startDate, endDate, budget, itinerary, summary, hotels) {
    this.trip = {
      start_date: startDate || 'Unknown',
      end_date: endDate || 'Unknown',
      budget: budget || 'Unknown',
      itinerary: itinerary || [],
      summary: summary || 'No trip summary available.',
      hotels: hotels || [],
    }
  }
}

async function bookHotel({
  city,
  checkinDate,
  checkoutDate,
  budgetMin,
  budgetMax,
  adults,
  firstName,
  lastName,
  email,
  phoneNumber,
}) {
  let browser
  try {
    const cityData = {
      London: '2280',
      'Manchester City Centre': '1077',
      'Edinburgh City Centre': '17250',
    }
    let destId = cityData[city] || '2280'
    let minBudget = parseInt(budgetMin, 10)
    let maxBudget = parseInt(budgetMax, 10)
    const maxRetries = 8
    let attempt = 0

    const launchBrowser = async () => {
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        defaultViewport: null,
        args: ['--start-maximized'],
      })

      console.log('Браузер запущен!')
    }

    const searchHotel = async () => {
      const page = await browser.newPage()

      const baseUrl = 'https://www.booking.com/searchresults.en-gb.html'
      const params = new URLSearchParams({
        aid: '304142',
        ss: city,
        checkin: checkinDate,
        checkout: checkoutDate,
        group_adults: adults,
        no_rooms: '1',
        group_children: '0',
        dest_id: destId,
        dest_type: 'district',
        nflt: `ht_id=204;class=4;class=5;fc=2;price=EUR-${minBudget}-${maxBudget}-1`,
      })

      const url = `${baseUrl}?${params.toString()}`
      console.log(`Переходим по ссылке: ${url}`)
      await page.goto(url, { waitUntil: 'networkidle2' })

      const hotelSelector = 'div[data-testid="property-card"] a[data-testid="title-link"]'
      await page.waitForSelector(hotelSelector, { timeout: 10000 })

      const hotelLink = await page.evaluate(() => {
        const elements = document.querySelectorAll('div[data-testid="property-card"] a[data-testid="title-link"]')
        return elements.length > 1 ? elements[1].href : null // Выбираем второй отель
      })

      if (!hotelLink) throw new Error('Не найден второй отель.')

      console.log(`Открываем второй отель: ${hotelLink}`)
      await page.goto(hotelLink, { waitUntil: 'networkidle2' })

      await page.goto(hotelLink, { waitUntil: 'networkidle2' })

      await page.waitForSelector('.hprt-nos-select.js-hprt-nos-select', { timeout: 10000 })

      await page.evaluate(() => {
        const select = document.querySelector('.hprt-nos-select.js-hprt-nos-select')
        if (select) {
          select.value = '1'
          select.dispatchEvent(new Event('change', { bubbles: true }))
        }
      })

      await page.waitForSelector('.bui-button__text.js-reservation-button__text', { timeout: 10000 })
      await page.evaluate(() => {
        const button = document.querySelector('.bui-button__text.js-reservation-button__text')
        if (button) button.click()
      })

      await delay(9000)

      await page.waitForSelector('input[name="firstname"]', { timeout: 10000 })
      await page.type('input[name="firstname"]', firstName)
      await page.type('input[name="lastname"]', lastName)
      await page.type('input[name="email"]', email)
      const emailConfirmSelector = 'input[name="emailConfirm"]'
      const emailConfirmField = await page.$(emailConfirmSelector)
      if (emailConfirmField) {
        await page.type(emailConfirmSelector, email)
        console.log('Поле подтверждения электронной почты заполнено.')
      }
      const phoneConfirmSelector = 'input[name="phone__number"]'
      const phoneConfirm = await page.$(phoneConfirmSelector)
      if (phoneConfirm) {
        await page.type(phoneConfirmSelector, phoneNumber)
        console.log('Поле подтверждения электронной почты заполнено.')
      }

      const ps = 'input[name="phoneNumber"]'
      const phoneConfirmSecond = await page.$(ps)
      if (phoneConfirmSecond) {
        await page.type(ps, phoneNumber)
        console.log('Поле подтверждения электронной почты заполнено.')
      }

      // Check if the first select element exists and select the option 'kz'
      const phoneCountry = await page.$('select[name="phone__country"]')
      if (phoneCountry) {
        await page.select('select[name="phone__country"]', 'kz')
      }

      // Check if the second select element exists and select the option 'kz'
      const cc1 = await page.$('select[name="cc1"]')
      if (cc1) {
        await page.select('select[name="cc1"]', 'kz')
      }
      // Check if the 'address1' input exists and fill it
      const addressInput = await page.$('input[name="address1"]')
      if (addressInput) {
        await page.type('input[name="address1"]', 'Your Address Here')
      } else {
        console.log('Address input not found')
      }

      // Check if the 'city' input exists and fill it
      const cityInput = await page.$('input[name="city"]')
      if (cityInput) {
        await page.type('input[name="city"]', 'Your City Here')
      } else {
        console.log('City input not found')
      }

      // Check if the submit button exists and is visible, then click it
      const sbb = await page.$('button[type="submit"]')
      if (sbb) {
        await page.waitForSelector('button[type="submit"]', { visible: true })
        await sbb.click()
      } else {
        console.log('Submit button not found')
      }

      console.log('Данные успешно введены и отправлены!')

      await page.waitForNavigation()

      // Wait for the element to be available before interacting with it
      const rejectButton = await page.$('#onetrust-reject-all-handler')
      if (rejectButton) {
        await rejectButton.click()
        console.log('Button clicked')
      } else {
        console.log('Button not found')
      }

      await page
        .waitForSelector('input[name="payment-timing"][value="PAY_TO_PROPERTY"]', { timeout: 5000 })
        .catch(async () => {
          console.log('"PAY_TO_PROPERTY" не найден, пробуем "PAY_LATER".')
          const payLaterOption = await page.$('input[name="payment-timing"][value="PAY_LATER"]')
          if (payLaterOption) {
            await payLaterOption.click()
          } else {
            console.log('Ни одна из опций не найдена.')
            throw new Error('Не найдены способы оплаты. Пробуем следующую попытку.')
          }
        })

      try {
        await page.waitForSelector('button[data-testid="double-booking-modal-confirm-button"]', { timeout: 5000 })
        await page.click('button[data-testid="double-booking-modal-confirm-button"]')
        console.log('Кнопка нажата!')
      } catch (error) {
        console.log('Кнопка не найдена.')
      }

      await page.evaluate(() => {
        const paymentOption = document.querySelector('input[name="payment-timing"][value="PAY_TO_PROPERTY"]')
        if (paymentOption) {
          paymentOption.click()
        }
      })

      const paymentFrame = page.frames().find((frame) => frame.url().includes('paymentcomponent.booking.com'))

      if (paymentFrame) {
        await paymentFrame.evaluate(() => {
          const fillField = (selector, value) => {
            const field = document.querySelector(selector)
            if (field) {
              field.value = value
              field.dispatchEvent(new Event('input', { bubbles: true }))
              field.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }

          fillField('input[name="name"]', 'Ali Akhanseriyev')
          fillField('input[autocomplete="cc-number"]', '4400430269922719')
          fillField('input[autocomplete="cc-exp"]', '07/25')
          fillField('input[autocomplete="cc-csc"]', '555')
        })
      } else {
        console.log('Фрейм с title "Payment" не найден')
      }

      // Check if the 'book' button exists and is visible, then click it
      const bookButton = await page.$('button[name="book"]')
      if (bookButton) {
        await page.waitForSelector('button[name="book"]', { visible: true })
        await page.click('button[name="book"]')
      }

      // Check if the 'submit' button exists and is visible, then click it
      const submitButton = await page.$('button[type="submit"]')
      if (submitButton) {
        await page.waitForSelector('button[type="submit"]', { visible: true })
        await page.click('button[type="submit"]')
      }

      await delay(25000)

      await page.waitForSelector('button[aria-label="Close modal"]')

      // Клик по кнопке закрытия
      await page.click('button[aria-label="Close modal"]')

      await delay(8000)

      if (await page.waitForSelector('button', { visible: true })) {
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))

          // Ищем кнопку с текстом "изменить или отменить"
          let targetButton = buttons.find((btn) =>
            btn.textContent.trim().toLowerCase().includes('изменить или отменить')
          )

          if (!targetButton) {
            // Если такой кнопки нет, ищем кнопку с текстом "изменить"
            targetButton = buttons.find((btn) => btn.textContent.trim().toLowerCase().includes('изменить'))
          }

          if (targetButton) {
            targetButton.click()
            console.log(`Кнопка "${targetButton.textContent.trim()}" нажата.`)
            return true
          } else {
            console.log('Кнопка "изменить или отменить" и "изменить" не найдена.')
            return false
          }
        })

        if (!clicked) {
          console.error('Не удалось найти нужную кнопку.')
        }
      }

      await delay(15000)

      await page.waitForFunction(
        () => {
          const address = document.querySelector('.mb-info--content.mb-hotel-info__address-details')
          const confirmationParagraphs = document.querySelectorAll('p')
          const dateElements = document.querySelectorAll(
            '[data-testid="PostBookingCheckinCheckout"] time .e1eebb6a1e.b80bba4aba'
          )

          return address && confirmationParagraphs.length > 0 && dateElements.length > 1
        },
        { timeout: 10000 }
      ) // Ожидаем до 10 секунд, пока элементы не будут найдены

      // Собираем данные после загрузки
      const bookingDetails = await page.evaluate(() => {
        const getText = (selector) => document.querySelector(selector)?.innerText.trim() || ''

        const address = getText('.mb-info--content.mb-hotel-info__address-details')

        // Ищем номер подтверждения и пин-код по тексту внутри <p>
        const confirmationParagraphs = Array.from(document.querySelectorAll('p'))
        let confirmationNumber = ''
        let pinCode = ''

        confirmationParagraphs.forEach((p) => {
          if (p.textContent.includes('Номер подтверждения:')) {
            confirmationNumber = p.querySelector('strong')?.innerText.trim() || ''
          }
          if (p.textContent.includes('Пин-код:')) {
            pinCode = p.querySelector('strong')?.innerText.trim() || ''
          }
        })

        // Даты заезда и выезда
        const dateElements = document.querySelectorAll(
          '[data-testid="PostBookingCheckinCheckout"] time .e1eebb6a1e.b80bba4aba'
        )
        const checkinDate = dateElements[0]?.innerText.trim() || ''
        const checkoutDate = dateElements[1]?.innerText.trim() || ''

        const hotelLink = document.querySelector('[data-testid="name-archor"]')
        let name = hotelLink ? hotelLink.innerText.trim() : null

        function splitAddress(address) {
          // Убираем лишние переносы строк
          const cleanedAddress = address.replace(/\n/g, ', ').trim()

          const regex = /^(.*?),\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}),?\s*(United Kingdom)?$/i
          const match = cleanedAddress.match(regex)

          if (match) {
            return {
              address: match[1].trim(),
              postalCode: match[2].trim(),
            }
          } else {
            return {
              address: cleanedAddress,
              postalCode: 'Не найден',
            }
          }
        }
        const result = splitAddress(address)
        const road = result.address
        const postCode = result.postalCode

        return { road, postCode, confirmationNumber, pinCode, checkinDate, checkoutDate, name }
      })

      console.log(bookingDetails)
      return { bookingDetails, city, currentUrl: await page.url() }
    }

    await launchBrowser()

    while (attempt < maxRetries) {
      try {
        console.log(`Попытка ${attempt + 1} с бюджетом: ${minBudget}-${maxBudget} EUR`)
        const result = await searchHotel()
        console.log('Бронирование завершено успешно:', result)
        await browser.close()
        return result
      } catch (error) {
        console.error(`Ошибка при попытке ${attempt + 1}:`, error)
        if (attempt + 1 < maxRetries) {
          minBudget += 30
          maxBudget += 30
          console.log(`Увеличиваем бюджет на 30 EUR: ${minBudget}-${maxBudget}`)
        } else {
          console.error('Достигнуто максимальное количество попыток.')
        }
        attempt++
      }
    }
  } catch (error) {
    console.error('Общая ошибка:', error)
  } finally {
    // if (browser) await browser.close();
  }
}

function extractHotelsAndSummary(tourData) {
  const monthMap = {
    января: '01',
    февраля: '02',
    марта: '03',
    апреля: '04',
    мая: '05',
    июня: '06',
    июля: '07',
    августа: '08',
    сентября: '09',
    октября: '10',
    ноября: '11',
    декабря: '12',
  }
  console.log('111')

  const hotels = tourData.trip.hotels.map((hotel) => {
    const checkinParts = hotel.bookingDetails.checkinDate.split(' ')
    const checkoutParts = hotel.bookingDetails.checkoutDate.split(' ')

    return {
      name: hotel.bookingDetails.name,
      address: hotel.bookingDetails.road,
      city: hotel.city,
      postCode: hotel.bookingDetails.postCode,
      fromDay: checkinParts[1],
      fromMonth: monthMap[checkinParts[2]],
      fromYear: checkinParts[3],
      toDay: checkoutParts[1],
      toMonth: monthMap[checkoutParts[2]],
      toYear: checkoutParts[3],
    }
  })

  const summary = tourData.trip.summary

  return { hotels, summary }
}

async function generateTour(departureDate, returnDate, budget, firstName, lastName, email, phone) {
  const cities = ['London', 'Manchester City Centre', 'Edinburgh City Centre']
  const tripDuration = (new Date(returnDate) - new Date(departureDate)) / (1000 * 60 * 60 * 24)
  let selectedCities = ['London']

  if (tripDuration > 15 && budget > 5000) {
    selectedCities.push('Manchester', 'Glasgow')
  } else {
    selectedCities.push(cities[Math.floor(Math.random() * 2) + 1])
  }
  selectedCities.push('London')

  const prompt = `I am applying for a UK visa and need a structured trip itinerary.
    The trip starts on ${departureDate} and ends on ${returnDate} with a budget of ${budget} USD.
    I will visit ${selectedCities.join(', ')}. 
    Generate a formal trip plan written in the first person, describing my journey as if I were explaining it myself.
    For each city, include the arrival and departure dates and describe my planned activities naturally, e.g., "I plan to explore London by visiting...".
    The response must be in JSON format:
    {
        "trip": {
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD",
            "budget": "USD",
            "itinerary": [
                {
                    "city": {
                        "name": "City Name",
                        "departureDay": "YYYY-MM-DD",
                        "arrivalDay": "YYYY-MM-DD",
                        "activities": "First-person narrative of planned activities."
                    }
                }
            ],
            "summary": "A short essay about "How I want to spend my trip" with my all activities, with all details for example the names of the museums, write 5-6 sentences , and write in simple english, Up to 450 charaterc without special characters, the limit of the essay is 450 characters"
        }
    }`

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are generating a first-person trip plan for a UK visa application.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const responseData = response.data.choices?.[0]?.message?.content
    if (!responseData) throw new Error('Invalid API response: No content received.')

    const tourData = JSON.parse(responseData)
    if (!tourData.trip || !tourData.trip.start_date || !tourData.trip.end_date) {
      throw new Error("Missing 'trip' details in API response.")
    }
    const dailyBudget = budget / tripDuration
    const budgetMin = Math.round(dailyBudget * 0.6)
    const budgetMax = budgetMin + 30
    let hotels = []
    for (const stop of tourData.trip.itinerary) {
      try {
        const hotelBooking = await bookHotel({
          city: stop.city.name,
          checkinDate: stop.city.arrivalDay,
          checkoutDate: stop.city.departureDay,
          budgetMin: budgetMin,
          budgetMax: budgetMax,
          adults: '1',
          firstName: firstName,
          lastName: lastName,
          email: email,
          phoneNumber: phone,
        })
        console.log(`Бронирование для ${stop.city.name}:`, hotelBooking)
        hotels.push(hotelBooking)
      } catch (error) {
        console.error(`Ошибка при бронировании в ${stop.city.name}:`, error)
        hotels.push(null)
      }
    }

    return new Tour(
      tourData.trip.start_date,
      tourData.trip.end_date,
      tourData.trip.budget,
      tourData.trip.itinerary,
      tourData.trip.summary,
      hotels
    )
  } catch (error) {
    console.error('❌ Error generating tour:', error.message)
    return new Tour(undefined, undefined, budget, [], 'Trip summary could not be generated.', [])
  }
}

export const config = {
  server: {
    port: '4000',
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['POST'],
    },
  },
  browser: {
    headless: process.env.NODE_ENV === 'production',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    taskTimeout: 300_000, // 5 min
    slowMo: 5,
    maxConcurrency: 3, // number of browser instances running at the same time
  },
}

const app = express()
const PORT = config.server.port
const MAX_CONCURRENT_TASKS = config.browser.maxConcurrency

app.use(express.json())
let cluster

;(async () => {
  try {
    cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: MAX_CONCURRENT_TASKS,
      puppeteerOptions: {
        headless: config.browser.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Безопасные аргументы
        defaultViewport: null,
      },
      retryLimit: 0, // Лимит повторов задач
      timeout: 300000, // Таймаут на задачу
    })

    // Обработка ошибок кластера
    cluster.on('taskerror', (err, data) => {
      console.error(`Ошибка в задаче с данными ${JSON.stringify(data)}: ${err}`)
    })

    let requestData = {
      email: 'abi_sana@gmail.com',
      password: 'P@SSword!123',
      telephoneNumber: '77088028903',
      givenNameFirst: 'Sansa',
      familyNameFirst: 'Sansych',
      isNameChanged: false,
      givenNameSecond: 'Sana',
      familyNameSecond: 'Abi',
      sex: 'M',
      selectedMarriedStatus: 'M',
      outOfCountryAddress: 'astana botan',
      outOfCountryAddress2Optional: 'astana botan',
      outOfCountryAddress3Optional: 'astana botan',
      townCity: 'astana',
      provinceRegionStateOptional: 'astana',
      postalCode: 'AB1 0AA',
      countryRef: 'Kazakhstan',
      isThisCorrespondenceAddress: true,
      selectedTime: { number: '3', unit: 'years' },
      statusOfOwnershipHome: 'ownershipCategory_own',
      otherDescHome: 'my choose',
      isUkAddress: false,
      ukAddress_line1: 'astana botan',
      ukAddress_townCity: 'astana',
      ukAddress_lookupPostCode: 'AB1 0AA',
      startDateAtAddress: { month: '02', year: '2019' },
      endDateAtAddress: { month: '04', year: '2020' },
      overseasAddress_line1: 'astana botan',
      overseasAddress_townCity: 'astana',
      overseasRegion: 'astana',
      overseasPostCode: 'AB1 0AA',
      anotherAddressPast2Years: false,
      passportNumber: '123456789',
      issuingAuthority: 'Astana',
      issueDate: { day: '01', month: '01', year: '2020' },
      expiryDate: { day: '01', month: '01', year: '2030' },
      passportId: '123456789',
      issuingAuthorityId: 'Astana',
      issueDateId: { day: '01', month: '01', year: '2020' },
      expiryDateId: { day: '01', month: '01', year: '2030' },
      nationality: 'Kazakhstan',
      countryOfBirth: 'Kazakhstan',
      placeOfBirth: 'Astana',
      dateOfBirth: { day: '01', month: '01', year: '2000' },
      otherNationality: false,
      selectedStatuses: ['status_student'],
      employerName: 'Astana',
      employerAddress: 'Astana',
      employerCity: 'Astana',
      employerState: 'Astana',
      employerPostCode: 'AB1 0AA',
      employerCountry: 'Kazakhstan',
      employerPhone: { code: '7', number: '7777777777' },
      workingDate: { month: '01', year: '2020' },
      jobTitle: 'Astana',
      earnValute: 'GBP',
      earnAmount: '1000',
      jobDescription: 'Astana',
      selectedStatusesOfIncomeSaving: ['typeOfIncomeRefs_regularIncome', 'typeOfIncomeRefs_moneyInBank'],
      selectedOtherRegularAdditionalIncome: [
        'sourceRefs_allowance',
        'sourceRefs_pension',
        'sourceRefs_investments',
        'sourceRefs_other',
      ],
      payingForYourVisit: true,
      whoWillBePaying: 'whoIsPayingRef_someoneIKnow',
      payeeName: 'Astana',
      address_line1: 'Astana',
      address_line2: 'Astana',
      address_line3: 'Astana',
      address_townCity: 'Astana',
      address_province: 'Astana',
      address_postalCode: 'AB1 0AA',
      address_countryRef_ui: 'Kazakhstan',
      choosenValue: 'GBP',
      choosenAmount: 'random',
      descriptionWhyAreTheyHelping: 'Astana',
      arrivalDay: '5',
      arrivalMonth: '3',
      arrivalYear: '2025',
      departureDay: '6',
      departureMonth: '4',
      departureYear: '2025',
      selectedReasonForYourVisit: 'purposeRef_tourism',
      selectedTourismSubtype: 'purposeRef_tourist',
      selectedBusinessSubtype: 'purposeRef_ppe',
      willYouPaidWhileInTheUK: true,
      whoWillPaying: 'astana',
      howMuchValue: 'GBP',
      howMuchAmount: '5000',
      whatBeingPaidFor: 'Astana',
      selectedPPESubtype: 'activityRef_studentExaminer',
      whoWillPaidBy: 'Astana',
      otherDesc: 'Astana',
      selectedTransitSubtype: 'purposeRef_visitorInTransit',
      placeOfArrivalInUk: 'Astana',
      transportReference: 'Astana',
      placeOfDeparture: 'Astana',
      transportReference2: 'Astana',
      whichCountryTravellingFromTheUK: 'Kazakhstan',
      whyGoingToThisCountry: 'purposeOfTravel_other',
      selectedIncomeTypes: ['typeOfIncomeRefs_regularIncome', 'typeOfIncomeRefs_moneyInBank'],
      moneyInBankAmount: '5000',
      moneySpendMonth: '600000',
      selectedRegularIncomeSources: ['ALLOWANCE', 'OTHER'],
      otherDescWhyGoingToThisCountry: 'Astana',
      whyTravellingThroughTheUK: 'Astana',
      doYouHaveValidVisa: true,
      residencePermitRef: 'Astana',
      dateOfIssueVisa: { day: '01', month: '01', year: '2024' },
      whereWasVisaIssued: 'Astana',
      organisationOrAgent: 'Astana',
      dateOfDeparture_day: '01',
      dateOfDeparture_month: '01',
      dateOfDeparture_year: '2026',
      placeOfDepartureInUk: 'Astana',
      transportReferenceShip: 'Astana',
      workAboardTransport: 'Astana',
      willYouPaidActivitiesWhileInTheUK: true,
      payerShip: 'Astana',
      howMuchValueShip: 'GBP',
      howMuchAmountShip: '5000',
      whatBeingPaidForShip: 'Astana',
      isEnrolledUKCourse: true,
      isCourseLasting30days: true,
      institutionName: 'Cambridge',
      courseName: 'IT',
      qualification: 'Engineer',
      CourseStartDate: { day: '01', month: '12', year: '2025' },
      CourseEndDate: { day: '01', month: '01', year: '2029' },
      isOtherCourses: false,
      other_institutionName: 'Cambridge',
      other_courseName: 'IT',
      other_qualification: 'Engineer',
      other_CourseStartDate: { day: '01', month: '01', year: '2020' },
      other_CourseEndDate: { day: '01', month: '01', year: '2020' },
      isPermissionATAS: true,
      AtasReferenceNumber: '123123',
      activities: 'Active',
      givenName: 'Alaska',
      familyName: 'Adams',
      partnerDateOfBirth: { day: '01', month: '01', year: '2002' },
      partnerCountry: 'Kazakhstan',
      liveWithYou: true,
      partner_address_line1: 'Astana',
      partner_address_townCity: 'Astana',
      partner_address_province: 'Astana',
      partner_address_postalCode: '05231',
      partner_address_countryRef_ui: 'Kazakhstan',
      travellingWithYou: true,
      partnerPassportNumber: '123123',
      dependants: [
        {
          givenName: 'John',
          familyName: 'Doe',
          dateOfBirth: { day: '01', month: '01', year: '2002' },
          relationship: 'brother',
          livingWithYou: true,
          travellingWithYou: true,
          passportNumber: '123123',
          partnerPassportNumber: '123123',
          country: 'Kazakhstan',
        },
      ],
      hasDependants_described: true,
      dependants_relationship: 'bratha',
      dependants_givenName: 'John',
      dependants_familyName: 'Doe',
      dependants_DateOfBirth: { day: '01', month: '01', year: '2002' },
      dependants_travellingWithYou: true,
      dependants_passportNumber: '123123',
      dependants_Country: 'Kazakhstan',
      dependants_passportNumber1: '123123',
      motherName: 'Alaska',
      mother_familyName: 'ABu',
      mother_DateOfBirth: { day: '01', month: '01', year: '2002' },
      mother_Country: 'Kazakhstan',
      isMotherSameCountry: true,
      mother_BornCountry: 'Kazakhstan',
      fatherName: 'Alaska',
      father_familyName: 'ABu',
      father_DateOfBirth: { day: '01', month: '01', year: '2002' },
      father_Country: 'Kazakhstan',
      isFatherSameCountry: true,
      father_BornCountry: 'Kazakhstan',
      isFamilyInUK: true,
      relative_relationship: 'Brother',
      relative_Name: 'Alaska',
      relative_familyName: 'ABu',
      relative_DateOfBirth: { day: '01', month: '01', year: '2002' },
      relative_passportNumber: '123123',
      relative_other: 'Other',
      relative_cannot: 'Cannot',
      isBeeninUK: false,
      howManyTimesInUK: 2,
      whyWereInUK: 'reasonRef_tourist',
      otherReason: 'Other',
      arrivalDate: { month: '01', year: '2002' },
      howLong: { type: 'days', amount: '2' },
      isMedicalTreatment: true,
      hadToPay: true,
      paidFullAmount: true,

      isTraveledCountries: 'bandRef_1',

      travelDetails: [
        {
          arrivalDate: { month: '01', year: '2024' },
          howLong: { type: 'days', amount: '2' },
          country: 'countryRef_canada',
          reason: 'reasonRef_tourist',
        },
      ],

      haveBeenOtherCountries: true,
      worldTravelCount: 1,
      // "worldCountryTravel": "Kyrgyzstan",
      // "worldReason": "reasonForVisit_tourism",
      // "visit_startDate": {"day": "01", "month": "01", "year": "2020"},
      // "visit_endDate": {"day": "01", "month": "01", "year": "2024"},
      travels: [
        {
          country: 'Kyrgyzstan',
          reason: 'reasonForVisit_tourism',
          startDate: { day: '01', month: '01', year: '2020' },
          endDate: { day: '01', month: '01', year: '2024' },
        },
      ],
      isImmigrated: false,
      countryForProblemOps: 'Japan',
      dateForProblem: { month: '01', year: '2023' },
      relevantInfoProblem: 'Details',
      isBreakedImmigration: false,
      selectedConvictionType: 'convictionTypeRef_none',
      gen_offence: '',
      selectedOffence: 'motoringOffenceRef_speeding',
      selectedСautionTypeRef: 'cautionTypeRef_caution',
      courtJudgmentRef: 'Judge, jurry executioneer',
      civilPenaltyReason: 'No reason',
      isWarCrime: false,
      warCrimesDetails: 'details',
      terroristActivitiesInvolvement: false,
      terroristActivitiesDetails: ';',
      terroristOrganisationsInvolvement: false,
      terroristOrganisationsDetails: 'asd',
      terroristViewsExpressed: false,
      terroristViewsDetails: 'asd',
      extremistOrganisationsInvolvement: false,
      extremistViewsExpressed: false,
      personOfGoodCharacter: false,
      otherActivities: false,
      anyOtherInfo: false,
      selectedEmploymentTypeRef: 'none_none',
      otherInformation: 'asdasd',
    }

    app.post('/updateData', (req, res) => {
      try {
        console.log('🔵 Получены новые данные для обновления:', req.body)

        // Обновляем только существующие ключи
        Object.keys(req.body).forEach((key) => {
          if (requestData.hasOwnProperty(key)) {
            requestData[key] = req.body[key]
          }
        })

        console.log('✅ Данные обновлены:', requestData)
        res.json({ message: 'Данные успешно обновлены' })
      } catch (error) {
        console.error('🚨 Ошибка при обновлении данных:', error)
        res.status(500).json({ message: 'Ошибка обновления данных' })
      }
    })

    app.post('/run-script', async (req, res) => {
      const url = 'https://visas-immigration.service.gov.uk/product/uk-visit-visa'

      if (!url) {
        return res.status(400).json({ error: 'URL is required' })
      }

      try {
        const today = new Date()
        const departureDate = new Date(today)
        departureDate.setMonth(today.getMonth() + 2) // +2 месяца

        const returnDate = new Date(departureDate)
        returnDate.setDate(departureDate.getDate() + (12 + Math.floor(Math.random() * 5))) // +12-16 дней

        const formatDate = (date) => date.toISOString().split('T')[0] // Формат YYYY-MM-DD

        const departureDay = formatDate(departureDate)
        const returnDay = formatDate(returnDate)

        const tourData = await generateTour(
          departureDay,
          returnDay,
          Math.round(requestData.moneyInBankAmount * 0.7),
          requestData.givenNameFirst,
          requestData.familyNameFirst,
          'adil.amangeldy17@gmail.com',
          requestData.telephoneNumber
        )

        const { hotels, summary } = extractHotelsAndSummary(tourData)

        //
        // const hotels = [
        //     {
        //         name: "Hotel One",
        //         address: "123 Main St",
        //         city: "Bremen",
        //         postCode: "12345",
        //         fromDay: "02",
        //         fromMonth: "06",
        //         fromYear: "2025",
        //         toDay: "05",
        //         toMonth: "06",
        //         toYear: "2025"
        //     },
        //     {
        //         name: "Hotel Two",
        //         address: "456 Another St",
        //         city: "Berlin",
        //         postCode: "67890",
        //         fromDay: "06",
        //         fromMonth: "06",
        //         fromYear: "2025",
        //         toDay: "10",
        //         toMonth: "06",
        //         toYear: "2025"
        //     }
        // ];
        // const summary = 'I want to travel to England because it\'s a country rich in history, culture, and beautiful landscapes. Visiting iconic landmarks like Big Ben, the Tower of London';
        // console.log(hotels);

        // Формируем строку в формате DDMMYYYY
        const dob =
          requestData.dateOfBirth.day.padStart(2, '0') +
          requestData.dateOfBirth.month.padStart(2, '0') +
          requestData.dateOfBirth.year

        // Формируем строку в формате "DD.MM.YYYY"
        const expiresAt =
          requestData.expiryDate.day.padStart(2, '0') +
          '.' +
          requestData.expiryDate.month.padStart(2, '0') +
          '.' +
          requestData.expiryDate.year

        const passengerData = {
          lastName: requestData.familyNameFirst,
          firstName: requestData.givenNameFirst,
          gender: requestData.sex,
          dob: dob,
          documentNumber: requestData.passportNumber,
          expiresAt: expiresAt,
          iin: requestData.passportId,
          email: 'wayqazaq@gmail.com',
          phone: requestData.telephoneNumber,
        }

        // Получаем строки в нужном формате
        const flightDate = (date) => {
          return (
            date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0')
          )
        }

        // Получаем строки в нужном формате
        const formattedDepartureDate = flightDate(departureDate)
        const formattedReturnDate = flightDate(returnDate)

        searchFlights(formattedDepartureDate, formattedReturnDate, passengerData)

        await cluster.queue(async ({ page }) => {
          await page.setUserAgent(config.browser.userAgent)
          await page.goto(url, { waitUntil: 'domcontentloaded' })

          let {
            email,
            password,
            telephoneNumber,
            givenNameFirst,
            familyNameFirst,
            isNameChanged,
            givenNameSecond,
            familyNameSecond,
            sex,
            selectedMarriedStatus,
            outOfCountryAddress,
            outOfCountryAddress2Optional,
            outOfCountryAddress3Optional,
            townCity,
            provinceRegionStateOptional,
            postalCode,
            countryRef,
            isThisCorrespondenceAddress,
            selectedTime,
            statusOfOwnershipHome,
            otherDescHome,
            isUkAddress,
            ukAddress_line1,
            ukAddress_townCity,
            ukAddress_lookupPostCode,
            startDateAtAddress,
            endDateAtAddress,
            overseasAddress_line1,
            overseasAddress_townCity,
            overseasRegion,
            overseasPostCode,
            anotherAddressPast2Years,
            passportNumber,
            issuingAuthority,
            issueDate,
            expiryDate,
            passportId,
            issuingAuthorityId,
            issueDateId,
            expiryDateId,
            nationality,
            countryOfBirth,
            placeOfBirth,
            dateOfBirth,
            otherNationality,
            selectedStatuses,
            employerName,
            employerAddress,
            employerCity,
            employerState,
            employerPostCode,
            employerCountry,
            employerPhone,
            workingDate,
            jobTitle,
            earnValute,
            earnAmount,
            jobDescription,
            selectedStatusesOfIncomeSaving,
            selectedOtherRegularAdditionalIncome,
            payingForYourVisit,
            whoWillBePaying,
            payeeName,
            address_line1,
            address_line2,
            address_line3,
            address_townCity,
            address_province,
            address_postalCode,
            address_countryRef_ui,
            choosenValue,
            choosenAmount,
            descriptionWhyAreTheyHelping,
            arrivalDay,
            arrivalMonth,
            arrivalYear,
            departureDay,
            departureMonth,
            departureYear,
            selectedReasonForYourVisit,
            selectedTourismSubtype,
            selectedBusinessSubtype,
            willYouPaidWhileInTheUK,
            whoWillPaying,
            howMuchValue,
            howMuchAmount,
            whatBeingPaidFor,
            selectedPPESubtype,
            whoWillPaidBy,
            otherDesc,
            selectedTransitSubtype,
            placeOfArrivalInUk,
            transportReference,
            placeOfDeparture,
            transportReference2,
            whichCountryTravellingFromTheUK,
            whyGoingToThisCountry,
            selectedIncomeTypes,
            moneyInBankAmount,
            moneySpendMonth,
            selectedRegularIncomeSources,
            otherDescWhyGoingToThisCountry,
            whyTravellingThroughTheUK,
            doYouHaveValidVisa,
            residencePermitRef,
            dateOfIssueVisa,
            whereWasVisaIssued,
            organisationOrAgent,
            dateOfDeparture_day,
            dateOfDeparture_month,
            dateOfDeparture_year,
            placeOfDepartureInUk,
            transportReferenceShip,
            workAboardTransport,
            willYouPaidActivitiesWhileInTheUK,
            payerShip,
            howMuchValueShip,
            howMuchAmountShip,
            whatBeingPaidForShip,
            isEnrolledUKCourse,
            isCourseLasting30days,
            institutionName,
            courseName,
            qualification,
            CourseStartDate,
            CourseEndDate,
            isOtherCourses,
            other_institutionName,
            other_courseName,
            other_qualification,
            other_CourseStartDate,
            other_CourseEndDate,
            isPermissionATAS,
            AtasReferenceNumber,
            activities,
            givenName,
            familyName,
            partnerDateOfBirth,
            partnerCountry,
            liveWithYou,
            partner_address_line1,
            partner_address_townCity,
            partner_address_province,
            partner_address_postalCode,
            partner_address_countryRef_ui,
            travellingWithYou,
            partnerPassportNumber,
            dependants,
            hasDependants_described,
            dependants_relationship,
            dependants_givenName,
            dependants_familyName,
            dependants_DateOfBirth,
            dependants_travellingWithYou,
            dependants_passportNumber,
            dependants_Country,
            dependants_passportNumber1,
            motherName,
            mother_familyName,
            mother_DateOfBirth,
            mother_Country,
            isMotherSameCountry,
            mother_BornCountry,
            fatherName,
            father_familyName,
            father_DateOfBirth,
            father_Country,
            isFatherSameCountry,
            father_BornCountry,
            isFamilyInUK,
            relative_relationship,
            relative_Name,
            relative_familyName,
            relative_DateOfBirth,
            relative_passportNumber,
            relative_other,
            relative_cannot,
            isBeeninUK,
            howManyTimesInUK,
            whyWereInUK,
            otherReason,
            arrivalDate,
            howLong,
            isMedicalTreatment,
            hadToPay,
            paidFullAmount,
            isTraveledCountries,
            travelDetails,
            haveBeenOtherCountries,
            worldTravelCount,
            worldCountryTravel,
            worldReason,
            visit_startDate,
            visit_endDate,
            travels,
            isImmigrated,
            countryForProblemOps,
            dateForProblem,
            relevantInfoProblem,
            isBreakedImmigration,
            selectedConvictionType,
            gen_offence,
            selectedOffence,
            selectedСautionTypeRef,
            courtJudgmentRef,
            civilPenaltyReason,
            isWarCrime,
            warCrimesDetails,
            terroristActivitiesInvolvement,
            terroristActivitiesDetails,
            terroristOrganisationsInvolvement,
            terroristOrganisationsDetails,
            terroristViewsExpressed,
            terroristViewsDetails,
            extremistOrganisationsInvolvement,
            extremistViewsExpressed,
            personOfGoodCharacter,
            otherActivities,
            anyOtherInfo,
            selectedEmploymentTypeRef,
            otherInformation,
          } = requestData
          console.log('Get data go forms')

          try {
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // console.log("Ожидаем чекбокс...");
            await page.waitForSelector('#languageCode_en', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#languageCode_en').click())
            // console.log("Чекбокс выбран!");

            // await new Promise(resolve => setTimeout(resolve, 2000));

            // console.log("Ожидаем кнопку...");
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // console.log("Кнопка нажата!");

            // console.log("Ожидаем чекбокс...");
            // await page.waitForSelector("#languageCode_ru", { visible: true });
            // await page.evaluate(() => document.querySelector("#languageCode_ru").click());
            // console.log("Чекбокс выбран!");

            // console.log("Ожидаем кнопку...");
            // await page.waitForSelector("#submit", { visible: true });
            // await page.evaluate(() => document.querySelector("#submit").click());
            // console.log("Кнопка нажата!");

            // console.log("Ожидаем чекбокс...");
            await page.waitForSelector('#visaType_visit-visa-ooc-standard', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#visaType_visit-visa-ooc-standard').click())
            // console.log("Чекбокс выбран!");

            // console.log("Ожидаем кнопку...");
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // console.log("Кнопка нажата!");

            // console.log("Ожидаем кнопку...");
            // await page.waitForSelector("#submit", { visible: true });
            // await page.evaluate(() => document.querySelector("#submit").click());
            // console.log("Кнопка нажата!");

            await page.waitForSelector('#countryCode_ui', { visible: true, timeout: 0 })
            await page.type('#countryCode_ui', 'Kazakhstan')
            // console.log("Текст введён!");

            // console.log("Ожидаем кнопку...");
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // console.log("Кнопка нажата!");

            // console.log("Ожидаем чекбокс...");
            await page.waitForSelector('#vacAvailabilityConfirmed_true', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#vacAvailabilityConfirmed_true').click())
            // console.log("Чекбокс выбран!");

            console.log('Ожидаем кнопку...')
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            console.log('Кнопка нажата!')

            console.log('Ожидаем кнопку...')
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')
            console.log('Кнопка нажата!')

            await page.waitForSelector('#email', { visible: true, timeout: 0 })
            await page.type('#email', email)
            console.log('Текст введён!')

            await page.waitForSelector('#password1', { visible: true, timeout: 0 })
            await page.type('#password1', password)
            console.log('Текст введён!')

            await page.waitForSelector('#password2', { visible: true, timeout: 0 })
            await page.type('#password2', password)
            console.log('Текст введён!')

            console.log('Ожидаем кнопку...')
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            console.log('Кнопка нажата!')

            // console.log("Ожидаем чекбокс...");
            await page.waitForSelector('#emailOwner_you', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#emailOwner_you').click())
            // console.log("Чекбокс выбран!");

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            await page.waitForSelector('#value_false', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#value_false').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // required telephoneNumber
            await page.waitForSelector('#telephoneNumber', { visible: true, timeout: 0 })
            await page.type('#telephoneNumber', telephoneNumber)
            // console.log("Текст введён!");

            await page.waitForSelector('#telephoneNumberPurpose_outsideUK', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#telephoneNumberPurpose_outsideUK').click())

            await page.waitForSelector('#telephoneNumberType_mobile', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#telephoneNumberType_mobile').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#addAnother_false').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            await page.waitForSelector('#contactByTelephone_callAndText', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#contactByTelephone_callAndText').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // required givenNameFirst
            await page.waitForSelector('#givenName', { visible: true, timeout: 0 })
            await page.type('#givenName', givenNameFirst)
            // required familyNameFirst
            await page.waitForSelector('#familyName', { visible: true, timeout: 0 })
            await page.type('#familyName', familyNameFirst)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            if (isNameChanged) {
              await page.waitForSelector('#addAnother_true', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#addAnother_true').click())

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())

              await page.waitForSelector('#givenName', { visible: true, timeout: 0 })
              await page.type('#givenName', givenNameSecond)

              await page.waitForSelector('#familyName', { visible: true, timeout: 0 })
              await page.type('#familyName', familyNameSecond)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())

              await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#addAnother_false').click())

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            } else {
              await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#addAnother_false').click())

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            }
            // required sex
            if (sex == 'M') {
              await page.waitForSelector('#gender_1', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#gender_1').click())
            } else if ((sex = 'F')) {
              await page.waitForSelector('#gender_2', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#gender_2').click())
            } else {
              await page.waitForSelector('#gender_9', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#gender_0').click())
            }
            // required selectedMarriedStatus
            await page.waitForSelector('#relationshipStatus', { visible: true, timeout: 0 })
            await page.select('#relationshipStatus', selectedMarriedStatus)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // required outOfCountryAddress
            await page.waitForSelector('#outOfCountryAddress_line1', { visible: true, timeout: 0 })
            await page.type('#outOfCountryAddress_line1', outOfCountryAddress)

            // if (outOfCountryAddress2Optional?.length > 0) {
            //     await page.waitForSelector("#outOfCountryAddress_line2", {visible: true, timeout: 0});
            //     await page.type("#outOfCountryAddress_line2", outOfCountryAddress2Optional);
            // }

            // if (outOfCountryAddress3Optional?.length > 0) {
            //     await page.waitForSelector("#outOfCountryAddress_line3", {visible: true, timeout: 0});
            //     await page.type("#outOfCountryAddress_line3", outOfCountryAddress3Optional);
            // }
            // required townCity
            await page.waitForSelector('#outOfCountryAddress_townCity', { visible: true, timeout: 0 })
            await page.type('#outOfCountryAddress_townCity', townCity)

            // if (provinceRegionStateOptional?.length > 0) {
            //     await page.waitForSelector("#outOfCountryAddress_province", {visible: true, timeout: 0});
            //     await page.type("#outOfCountryAddress_province", provinceRegionStateOptional);
            // }

            if (postalCode?.length > 0) {
              await page.waitForSelector('#outOfCountryAddress_postCode', { visible: true, timeout: 0 })
              await page.type('#outOfCountryAddress_postCode', postalCode)
            }
            // required countryRef страна проживания
            await page.waitForSelector('#outOfCountryAddress_countryRef_ui', { visible: true, timeout: 0 })
            await page.type('#outOfCountryAddress_countryRef_ui', countryRef)
            // not required
            if (isThisCorrespondenceAddress !== false) {
              await page.waitForSelector('#isCorrespondenceAddress_true', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#isCorrespondenceAddress_true').click())
            } else {
              await page.waitForSelector('#isCorrespondenceAddress_false', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#isCorrespondenceAddress_false').click())
            }

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            // required selectedTime "selectedTime": {"number": "3", "unit": "months"},
            await page.waitForSelector('#timeLivedUnit', { visible: true, timeout: 0 })
            await page.select('#timeLivedUnit', selectedTime.unit)
            console.log(`Выбрано: ${selectedTime.unit}`)

            await page.waitForSelector('#timeLived', { visible: true, timeout: 0 })
            await page.type('#timeLived', selectedTime.number)
            console.log(`Введено количество: ${selectedTime.number}`)
            // required statusOfOwnershipHome
            if (statusOfOwnershipHome == 'OWNED') {
              await page.waitForSelector(`#ownershipCategory_own`, { visible: true, timeout: 0 })
              await page.click(`#ownershipCategory_own`)
            } else if (statusOfOwnershipHome == 'RENTED') {
              await page.waitForSelector(`#ownershipCategory_rent`, { visible: true, timeout: 0 })
              await page.click(`#ownershipCategory_rent`)
            } else {
              await page.waitForSelector(`#${statusOfOwnershipHome}`, { visible: true, timeout: 0 })
              await page.click(`#${statusOfOwnershipHome}`)
            }
            // Кому принадлежал этот дом?   OWNED OR RENTED
            if (statusOfOwnershipHome == statusOfOwnership.OTHER) {
              await page.waitForSelector('#otherCategoryDetails', { visible: true, timeout: 0 })
              await page.type('#otherCategoryDetails', otherDescHome)
            }

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')
            if (isLessThanTwoYears(selectedTime)) {
              if (isUkAddress) {
                console.log('isUkAddress_true')
                await page.waitForSelector('#isUkAddress_true', { visible: true, timeout: 0 })
                await page.click('#isUkAddress_true')

                await page.waitForSelector('#ukAddress_line1', { visible: true, timeout: 0 })
                await page.type('#ukAddress_line1', ukAddress_line1)

                await page.waitForSelector('#ukAddress_townCity', { visible: true, timeout: 0 })
                await page.type('#ukAddress_townCity', ukAddress_townCity)

                await page.waitForSelector('#ukAddress_lookupPostCode', { visible: true, timeout: 0 })
                await page.type('#ukAddress_lookupPostCode', ukAddress_lookupPostCode)

                await page.waitForSelector('#startDateAtAddress_month', { visible: true, timeout: 0 })
                await page.type('#startDateAtAddress_month', startDateAtAddress.month)

                await page.waitForSelector('#startDateAtAddress_year', { visible: true, timeout: 0 })
                await page.type('#startDateAtAddress_year', startDateAtAddress.year)

                await page.waitForSelector('#endDateAtAddress_month', { visible: true, timeout: 0 })
                await page.type('#endDateAtAddress_month', endDateAtAddress.month)

                await page.waitForSelector('#endDateAtAddress_year', { visible: true, timeout: 0 })
                await page.type('#endDateAtAddress_year', endDateAtAddress.year)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.click('#submit')
              } else {
                console.log('addAnother_false')
                await page.waitForSelector('#isUkAddress_false', { visible: true, timeout: 0 })
                await page.click('#isUkAddress_false')
                // required
                await page.waitForSelector('#overseasAddress_line1', { visible: true, timeout: 0 })
                await page.type('#overseasAddress_line1', overseasAddress_line1)
                // required
                await page.waitForSelector('#overseasAddress_townCity', { visible: true, timeout: 0 })
                await page.type('#overseasAddress_townCity', overseasAddress_townCity)
                // required
                await page.waitForSelector('#overseasAddress_province', { visible: true, timeout: 0 })
                await page.type('#overseasAddress_province', overseasRegion)
                // required
                await page.waitForSelector('#overseasAddress_postCode', { visible: true, timeout: 0 })
                await page.type('#overseasAddress_postCode', overseasPostCode)
                // required
                await page.waitForSelector('#overseasAddress_countryRef', { visible: true, timeout: 0 })
                await page.select('#overseasAddress_countryRef', 'KAZ')
                // required
                await page.waitForSelector('#startDateAtAddress_month', { visible: true, timeout: 0 })
                await page.type('#startDateAtAddress_month', startDateAtAddress.month)
                // required
                await page.waitForSelector('#startDateAtAddress_year', { visible: true, timeout: 0 })
                await page.type('#startDateAtAddress_year', startDateAtAddress.year)
                // required
                await page.waitForSelector('#endDateAtAddress_month', { visible: true, timeout: 0 })
                await page.type('#endDateAtAddress_month', endDateAtAddress.month)
                // required
                await page.waitForSelector('#endDateAtAddress_year', { visible: true, timeout: 0 })
                await page.type('#endDateAtAddress_year', endDateAtAddress.year)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.click('#submit')
              }

              await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
              await page.click('#addAnother_false')

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')
            }
            // required passportNumber
            await page.waitForSelector('#travelDocumentNumber', { visible: true, timeout: 0 })
            await page.type('#travelDocumentNumber', passportNumber)
            // required Кто выдал
            await page.waitForSelector('#issuingCountry', { visible: true, timeout: 0 })
            await page.type('#issuingCountry', issuingAuthority)
            // required issueDate {"day": "01", "month": "01", "year": "2020"}
            await page.waitForSelector('#dateOfIssue_day', { visible: true, timeout: 0 })
            await page.type('#dateOfIssue_day', issueDate.day)

            await page.waitForSelector('#dateOfIssue_month', { visible: true, timeout: 0 })
            await page.type('#dateOfIssue_month', issueDate.month)

            await page.waitForSelector('#dateOfIssue_year', { visible: true, timeout: 0 })
            await page.type('#dateOfIssue_year', issueDate.year)
            // required expiryDate {"day": "01", "month": "01", "year": "2020"}
            await page.waitForSelector('#expiryDate_day', { visible: true, timeout: 0 })
            await page.type('#expiryDate_day', expiryDate.day)

            await page.waitForSelector('#expiryDate_month', { visible: true, timeout: 0 })
            await page.type('#expiryDate_month', expiryDate.month)

            await page.waitForSelector('#expiryDate_year', { visible: true, timeout: 0 })
            await page.type('#expiryDate_year', expiryDate.year)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            //

            //
            await page.waitForSelector('#hasValidIdCard_true', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#hasValidIdCard_true').click())
            // required passportId
            await page.waitForSelector('#nationalIdCardNo', { visible: true, timeout: 0 })
            await page.type('#nationalIdCardNo', passportId)
            // required issuingAuthorityId
            await page.waitForSelector('#issuingAuthority', { visible: true, timeout: 0 })
            await page.type('#issuingAuthority', issuingAuthorityId)
            // required issueDateId
            await page.waitForSelector('#issueDate_day', { visible: true, timeout: 0 })
            await page.type('#issueDate_day', issueDateId.day)

            await page.waitForSelector('#issueDate_month', { visible: true, timeout: 0 })
            await page.type('#issueDate_month', issueDateId.month)

            await page.waitForSelector('#issueDate_year', { visible: true, timeout: 0 })
            await page.type('#issueDate_year', issueDateId.year)
            // required expiryDateId
            await page.waitForSelector('#expiryDate_day', { visible: true, timeout: 0 })
            await page.type('#expiryDate_day', expiryDateId.day)

            await page.waitForSelector('#expiryDate_month', { visible: true, timeout: 0 })
            await page.type('#expiryDate_month', expiryDateId.month)

            await page.waitForSelector('#expiryDate_year', { visible: true, timeout: 0 })
            await page.type('#expiryDate_year', expiryDateId.year)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            //
            // required nationality Kazakhstan
            await page.waitForSelector('#nationality_ui', { visible: true, timeout: 0 })
            await page.type('#nationality_ui', nationality)
            // required countryOfBirth Kazakhstan
            await page.waitForSelector('#countryOfBirth_ui', { visible: true, timeout: 0 })
            await page.type('#countryOfBirth_ui', countryOfBirth)
            // required placeOfBirth
            await page.waitForSelector('#placeOfBirth', { visible: true, timeout: 0 })
            await page.type('#placeOfBirth', placeOfBirth)
            // required dateOfBirth  {"day": "01", "month": "01", "year": "2002"}
            await page.waitForSelector('#dob_day', { visible: true, timeout: 0 })
            await page.type('#dob_day', dateOfBirth.day)

            await page.waitForSelector('#dob_month', { visible: true, timeout: 0 })
            await page.type('#dob_month', dateOfBirth.month)

            await page.waitForSelector('#dob_year', { visible: true, timeout: 0 })
            await page.type('#dob_year', dateOfBirth.year)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            //required otherNationality Другое гражданство
            if (otherNationality) {
            } else {
              await page.waitForSelector('#hasOtherNationality_false', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#hasOtherNationality_false').click())
            }
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            /*
                        //required selectedStatuses массив из значений
                        {
                            EMPLOYED: "status_employed",
                            SELF_EMPLOYED: "status_self-employed",
                            STUDENT: "status_student",
                            RETIRED: "status_retired",
                            UNEMPLOYED: "status_unemployed"
                        }
                        */
            for (let status of selectedStatuses) {
              const selector = `#${status}`
              await page.waitForSelector(selector, { visible: true, timeout: 0 })
              await page.click(selector)
              console.log(`Выбран статус: ${status}`)
            }

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')

            if (selectedStatuses.includes(EmploymentStatus.EMPLOYED)) {
              await page.waitForSelector('#employer', { visible: true, timeout: 0 })
              await page.type('#employer', employerName)

              await page.waitForSelector('#address_line1', { visible: true, timeout: 0 })
              await page.type('#address_line1', employerAddress)

              await page.waitForSelector('#address_townCity', { visible: true, timeout: 0 })
              await page.type('#address_townCity', employerCity)

              await page.waitForSelector('#address_province', { visible: true, timeout: 0 })
              await page.type('#address_province', employerState)

              await page.waitForSelector('#address_postalCode', { visible: true, timeout: 0 })
              await page.type('#address_postalCode', employerPostCode)

              await page.waitForSelector('#address_countryRef_ui', { visible: true, timeout: 0 })
              await page.type('#address_countryRef_ui', employerCountry)

              await page.waitForSelector('#phone_code', { visible: true, timeout: 0 })
              await page.type('#phone_code', employerPhone.code)

              await page.waitForSelector('#phone_number', { visible: true, timeout: 0 })
              await page.type('#phone_number', employerPhone.number)

              await page.waitForSelector('#jobStartDate_month', { visible: true, timeout: 0 })
              await page.type('#jobStartDate_month', workingDate.month)

              await page.waitForSelector('#jobStartDate_year', { visible: true, timeout: 0 })
              await page.type('#jobStartDate_year', workingDate.year)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())

              await page.waitForSelector('#jobTitle', { visible: true, timeout: 0 })
              await page.type('#jobTitle', jobTitle)

              await page.waitForSelector('#earnings_currencyRef', { visible: true, timeout: 0 })
              await page.select('#earnings_currencyRef', earnValute)

              await page.waitForSelector('#earnings_amount', { visible: true, timeout: 0 })
              await page.type('#earnings_amount', earnAmount)

              await page.waitForSelector('#jobDescription', { visible: true, timeout: 0 })
              await page.type('#jobDescription', jobDescription)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            } else if (selectedStatuses.includes(EmploymentStatus.SELF_EMPLOYED)) {
              await page.waitForSelector('#jobTitle', { visible: true, timeout: 0 })
              await page.type('#jobTitle', jobTitle)

              await page.waitForSelector('#income_currencyRef', { visible: true, timeout: 0 })
              await page.select('#income_currencyRef', earnValute)

              await page.waitForSelector('#income_amount', { visible: true, timeout: 0 })
              await page.type('#income_amount', earnAmount)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            }

            // await page.waitForSelector("#typeOfIncomeRefs_regularIncome", {visible: true, timeout: 0});
            // await page.evaluate(() => document.querySelector("#typeOfIncomeRefs_regularIncome").click());

            await page.waitForSelector('#typeOfIncomeRefs_moneyInBank', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#typeOfIncomeRefs_moneyInBank').click())

            //required "selectedIncomeTypes": ["typeOfIncomeRefs_regularIncome", "typeOfIncomeRefs_moneyInBank"], Есть ли доп заработок

            let selectedIncomeTypes = ['typeOfIncomeRefs_moneyInBank']

            if (selectedIncomeTypes.includes(IncomeType.REGULAR_INCOME)) {
              await selectCheckbox(page, `#${IncomeType.REGULAR_INCOME}`)
              // Выбираем источники регулярного дохода
              //required selectedRegularIncomeSources = ["ALLOWANCE", "OTHER"];
              if (selectedRegularIncomeSources === undefined) {
                selectedRegularIncomeSources = ['ALLOWANCE', 'OTHER']
              }
              for (let source of selectedRegularIncomeSources) {
                if (RegularIncomeSources[source]) {
                  await selectCheckbox(page, `#${RegularIncomeSources[source]}`)
                }
              }
              // Дополнительный доход (если выбран OTHER)
              if (selectedRegularIncomeSources.includes('OTHER')) {
                await Promise.all([
                  page.waitForSelector('#income_currencyRef', { visible: true, timeout: 0 }),
                  page.waitForSelector('#income_amount', { visible: true, timeout: 0 }),
                ])
                await page.select('#income_currencyRef', 'GBP')
                const randomAmount = Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000
                await page.type('#income_amount', randomAmount.toString())
              }
            }

            // Обработка SAVINGS
            if (selectedIncomeTypes.includes(IncomeType.SAVINGS)) {
              await selectCheckbox(page, `#${IncomeType.SAVINGS}`)

              await Promise.all([
                page.waitForSelector('#moneyInBankAmount_currencyRef', { visible: true, timeout: 0 }),
                page.waitForSelector('#moneyInBankAmount_amount', { visible: true, timeout: 0 }),
              ])

              await page.select('#moneyInBankAmount_currencyRef', 'GBP')
              // not required maybe? moneyInBankAmount
              if (moneyInBankAmount === undefined) {
                moneyInBankAmount = (Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000).toString()
              }

              await page.type('#moneyInBankAmount_amount', moneyInBankAmount)
            }

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')

            //Cost
            //required ?? Под вопросом
            await page.waitForSelector('#value_currencyRef', { visible: true, timeout: 0 })
            await page.select('#value_currencyRef', 'GBP')
            const randomAmount3 = Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000
            await page.waitForSelector('#value_amount', { visible: true, timeout: 0 })
            await page.type('#value_amount', randomAmount3.toString())
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')

            //Financial situation
            await delay(1000)

            await page.waitForSelector('#value_currencyRef', { visible: true, timeout: 0 })
            await page.select('#value_currencyRef', 'GBP')
            if (moneySpendMonth === undefined) {
              moneySpendMonth = (Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000).toString()
            }
            // required moneySpendMonth
            await page.waitForSelector('#value_amount', { visible: true, timeout: 0 })
            await page.type('#value_amount', moneySpendMonth)
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            // not required
            console.log('payingForYourVisit: ')
            console.log(payingForYourVisit)
            if (payingForYourVisit) {
              await page.waitForSelector('#value_true', { visible: true, timeout: 0 })
              await page.click('#value_true') // Выбираем радио-кнопку
              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')
              /* required whoWillBePaying
                            {
                                 SOMEONE_I_KNOW: "whoIsPayingRef_someoneIKnow",
                                 MY_EMPLOYER_OR_COMPANY: "whoIsPayingRef_myEmployerOrCompany",
                                 ANOTHER_COMPANY_OR_ORGANISATION: "whoIsPayingRef_otherEmployerOrCompany"
                            }
                            */
              await page.waitForSelector(`#${whoWillBePaying}`, { visible: true, timeout: 0 })
              await page.click(`#${whoWillBePaying}`)

              if (
                whoWillBePaying == whoWillBePayingVisit.SOMEONE_I_KNOW ||
                whoWillBePaying == whoWillBePayingVisit.ANOTHER_COMPANY_OR_ORGANISATION
              ) {
                //required
                await page.waitForSelector('#payeeName', { visible: true, timeout: 0 })
                await page.type('#payeeName', payeeName)
                //required
                await page.waitForSelector('#address_line1', { visible: true, timeout: 0 })
                await page.type('#address_line1', address_line1)

                // if (address_line2.length > 0) {
                //     await page.waitForSelector("#address_line2", {visible: true, timeout: 0});
                //     await page.type("#address_line2", address_line2);
                // }
                //
                // if (address_line3.length > 0) {
                //     await page.waitForSelector("#address_line3", {visible: true, timeout: 0});
                //     await page.type("#address_line3", address_line3);
                // }
                //required
                await page.waitForSelector('#address_townCity', { visible: true, timeout: 0 })
                await page.type('#address_townCity', address_townCity)
                //not required
                if (address_province !== undefined) {
                  await page.waitForSelector('#address_province', { visible: true, timeout: 0 })
                  await page.type('#address_province', address_province)
                }
                //not required
                if (address_postalCode !== undefined) {
                  await page.waitForSelector('#address_postalCode', { visible: true, timeout: 0 })
                  await page.type('#address_postalCode', address_postalCode)
                }
                //required address_countryRef_ui
                await page.waitForSelector('#address_countryRef_ui', { visible: true, timeout: 0 })
                await page.type('#address_countryRef_ui', address_countryRef_ui)
              }

              await page.waitForSelector('#amount_currencyRef', { visible: true, timeout: 0 })
              await page.select('#amount_currencyRef', 'GBP')
              //required someonePayingAmount
              const randomAmount5 = Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000
              await page.waitForSelector('#amount_amount', { visible: true, timeout: 0 })
              await page.type('#amount_amount', randomAmount5.toString())

              //required descriptionWhyAreTheyHelping
              await page.waitForSelector('#reason', { visible: true, timeout: 0 })
              await page.type('#reason', descriptionWhyAreTheyHelping)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())

              await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
              await page.click('#addAnother_false')

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            } else {
              await page.waitForSelector('#value_false', { visible: true, timeout: 0 })
              await page.click('#value_false') // Выбираем радио-кнопку
              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')
            }

            arrivalDay = departureDate.getDate().toString()
            arrivalMonth = (departureDate.getMonth() + 1).toString() // +1, так как JS считает месяцы с 0
            arrivalYear = departureDate.getFullYear().toString()
            departureDay = returnDate.getDate().toString()
            departureMonth = (returnDate.getMonth() + 1).toString()
            departureYear = returnDate.getFullYear().toString()

            //required arrivalDay
            await page.waitForSelector('#dateOfArrival_day', { visible: true, timeout: 0 })
            await page.type('#dateOfArrival_day', arrivalDay)
            //required
            await page.waitForSelector('#dateOfArrival_month', { visible: true, timeout: 0 })
            await page.type('#dateOfArrival_month', arrivalMonth)
            //required
            await page.waitForSelector('#dateOfArrival_year', { visible: true, timeout: 0 })
            await page.type('#dateOfArrival_year', arrivalYear)
            //required
            await page.waitForSelector('#dateOfLeave_day', { visible: true, timeout: 0 })
            await page.type('#dateOfLeave_day', departureDay)
            //required
            await page.waitForSelector('#dateOfLeave_month', { visible: true, timeout: 0 })
            await page.type('#dateOfLeave_month', departureMonth)
            //required
            await page.waitForSelector('#dateOfLeave_year', { visible: true, timeout: 0 })
            await page.type('#dateOfLeave_year', departureYear)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            console.log(7)
            await page.waitForSelector('#preferredLanguage_english', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#preferredLanguage_english').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            console.log(9)
            //required selectedReasonForYourVisit
            /*
                        {
                            TOURISM: "purposeRef_tourism",
                            BUSINESS: "purposeRef_business",
                            TRANSIT: "purposeRef_transit",
                            ACADEMIC: "purposeRef_academic",
                            MARRIAGE: "purposeRef_marriage",
                            MEDICAL_TREATMENT: "purposeRef_medicalTreatment",
                            STUDY: "purposeRef_study",
                            OTHER: "purposeRef_other"
                        }
                         */
            await page.waitForSelector('#' + selectedReasonForYourVisit, { visible: true, timeout: 0 })
            await page.evaluate(
              (selectedReasonForYourVisit) => document.querySelector('#' + selectedReasonForYourVisit).click(),
              selectedReasonForYourVisit
            )

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            if (selectedReasonForYourVisit == reasonForYourVisit.TOURISM) {
              //required selectedTourismSubtype
              /*
                            {
                                TOURIST: "purposeRef_tourist",
                                VISITING_FAMILY: "purposeRef_visitingFamily",
                                VISITING_FRIENDS: "purposeRef_visitingFriends"
                            }
                             */
              selectedTourismSubtype = 'purposeRef_tourist'
              await page.waitForSelector(`#purposeRef_tourist`, { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector(`#purposeRef_tourist`).click())

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            } else if (selectedReasonForYourVisit == reasonForYourVisit.BUSINESS) {
              if (selectedBusinessSubtype == businessSubtypes.OTHER) {
                //requiredif businessSubtypes otherDesc
                await page.waitForSelector('#description', { visible: true, timeout: 0 })
                await page.type('#description', otherDesc)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())
              } else {
                /* required selectedBusinessSubtype
                                {
                                    ATTEND_BUSINESS_MEEETING: "purposeRef_meeting",
                                    RESEARCH_OR_FACT_FINDING: "purposeRef_research",
                                    BUSINESS_RELATED_TRAINING: "purposeRef_jobTraining",
                                    ATTEND_LECTURE: "purposeRef_lectures",
                                    PERFORM_ENTERTAIMENT_EVENT: "purposeRef_entertainmentEvent",
                                    PERFORM_SPORTING_EVENT: "purposeRef_sportEvent",
                                    RELIGIOUS_ACTIVITIES: "purposeRef_religious",
                                    SECURE_FUNDING: "purposeRef_secureFunding",
                                    PLAB: "purposeRef_plab",
                                    CLINICAL_ATTACHMENTS: "purposeRef_clinicalAttachments",
                                    PPE: "purposeRef_ppe",
                                    OTHER: "purposeRef_other"
                                }
                                 */
                await page.waitForSelector(`#${selectedBusinessSubtype}`, { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector(`#${selectedBusinessSubtype}`).click())

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())
              }

              if (willYouPaidWhileInTheUK) {
                await page.waitForSelector(`#value_true`, { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector(`#value_true`).click())

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                await page.waitForSelector('#payer', { visible: true, timeout: 0 })
                await page.type('#payer', whoWillPaying)
                await page.waitForSelector('#earnings_currencyRef', { visible: true, timeout: 0 })
                await page.select('#earnings_currencyRef', howMuchValue)
                const randomAmount6 = Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000
                await page.waitForSelector('#earnings_amount', { visible: true, timeout: 0 })
                await page.type('#earnings_amount', howMuchAmount)

                await page.waitForSelector('#paidActivity', { visible: true, timeout: 0 })
                await page.type('#paidActivity', whatBeingPaidFor)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())
              } else {
                await page.waitForSelector(`#value_false`, { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector(`#value_false`).click())

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())
              }

              if (selectedBusinessSubtype == businessSubtypes.PPE) {
                await page.waitForSelector(`#${selectedPPESubtype}`, { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector(`#${selectedPPESubtype}`).click())

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                await page.waitForSelector('#paidBy', { visible: true, timeout: 0 })
                await page.type('#paidBy', whoWillPaidBy)
              }
            } else if (selectedReasonForYourVisit == reasonForYourVisit.TRANSIT) {
              await page.waitForSelector(`#${selectedTransitSubtype}`, { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector(`#${selectedTransitSubtype}`).click())

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())

              if (selectedTransitSubtype == transitSubtypes.JOIN_SHIP_OR_AIRCRAFT) {
                await page.waitForSelector('#organisationOrAgent', { visible: true, timeout: 0 })
                await page.type('#organisationOrAgent', organisationOrAgent)

                await page.waitForSelector('#dateOfDeparture_day', { visible: true, timeout: 0 })
                await page.type('#dateOfDeparture_day', dateOfDeparture_day)

                await page.waitForSelector('#dateOfDeparture_month', { visible: true, timeout: 0 })
                await page.type('#dateOfDeparture_month', dateOfDeparture_month)

                await page.waitForSelector('#dateOfDeparture_year', { visible: true, timeout: 0 })
                await page.type('#dateOfDeparture_year', dateOfDeparture_year)

                await page.waitForSelector('#placeOfDepartureInUk', { visible: true, timeout: 0 })
                await page.type('#placeOfDepartureInUk', placeOfDepartureInUk)

                await page.waitForSelector('#transportReference', { visible: true, timeout: 0 })
                await page.type('#transportReference', transportReferenceShip)

                await page.waitForSelector('#workAboardTransport', { visible: true, timeout: 0 })
                await page.type('#workAboardTransport', workAboardTransport)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                console.log('Done1')
                if (willYouPaidActivitiesWhileInTheUK) {
                  await page.waitForSelector(`#value_true`, { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector(`#value_true`).click())

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())

                  await page.waitForSelector('#payer', { visible: true, timeout: 0 })
                  await page.type('#payer', payerShip)
                  await page.waitForSelector('#earnings_currencyRef', { visible: true, timeout: 0 })
                  await page.select('#earnings_currencyRef', howMuchValueShip)
                  // const randomAmount6 = Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000;
                  await page.waitForSelector('#earnings_amount', { visible: true, timeout: 0 })
                  await page.type('#earnings_amount', howMuchAmountShip)

                  await page.waitForSelector('#paidActivity', { visible: true, timeout: 0 })
                  await page.type('#paidActivity', whatBeingPaidForShip)

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                } else {
                  await page.waitForSelector(`#value_false`, { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector(`#value_false`).click())

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                }
              } else {
                await page.waitForSelector('#placeOfArrivalInUk', { visible: true, timeout: 0 })
                await page.type('#placeOfArrivalInUk', placeOfArrivalInUk)

                await page.waitForSelector('#transportReference', { visible: true, timeout: 0 })
                await page.type('#transportReference', transportReference)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                await page.waitForSelector('#placeOfDeparture', { visible: true, timeout: 0 })
                await page.type('#placeOfDeparture', placeOfDeparture)

                await page.waitForSelector('#transportReference', { visible: true, timeout: 0 })
                await page.type('#transportReference', transportReference2)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                await page.waitForSelector('#countryToTravelRefs_ui', { visible: true, timeout: 0 })
                await page.type('#countryToTravelRefs_ui', whichCountryTravellingFromTheUK)

                await page.waitForSelector(`#${whyGoingToThisCountry}`, { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector(`#${whyGoingToThisCountry}`).click())

                if (whyGoingToThisCountry == whyGoingToThisCountry.OTHER) {
                  await page.waitForSelector('#travelDetails', { visible: true, timeout: 0 })
                  await page.type('#travelDetails', otherDescWhyGoingToThisCountry)
                }

                await page.waitForSelector('#reason', { visible: true, timeout: 0 })
                await page.type('#reason', whyTravellingThroughTheUK)

                if (doYouHaveValidVisa) {
                  await page.waitForSelector(`#residencePermit_true`, { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector(`#residencePermit_true`).click())

                  await page.waitForSelector('#residencePermitRef', { visible: true, timeout: 0 })
                  await page.type('#residencePermitRef', residencePermitRef)

                  await page.waitForSelector('#issueDate_day', { visible: true, timeout: 0 })
                  await page.type('#issueDate_day', dateOfIssueVisa.day)

                  await page.waitForSelector('#issueDate_month', { visible: true, timeout: 0 })
                  await page.type('#issueDate_month', dateOfIssueVisa.month)

                  await page.waitForSelector('#issueDate_year', { visible: true, timeout: 0 })
                  await page.type('#issueDate_year', dateOfIssueVisa.year)

                  await page.waitForSelector('#issuePlace', { visible: true, timeout: 0 })
                  await page.type('#issuePlace', whereWasVisaIssued)

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                } else {
                  await page.waitForSelector(`#residencePermit_false`, { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector(`#residencePermit_false`).click())
                }

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())
              }
            } else if (selectedReasonForYourVisit == reasonForYourVisit.ACADEMIC) {
            } else if (selectedReasonForYourVisit == reasonForYourVisit.MARRIAGE) {
            } else if (selectedReasonForYourVisit == reasonForYourVisit.MEDICAL_TREATMENT) {
            } else if (selectedReasonForYourVisit == reasonForYourVisit.STUDY) {
              if (isEnrolledUKCourse) {
                await page.waitForSelector('#enrolledInUKCourse_true', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#enrolledInUKCourse_true').click())

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                await page.waitForSelector('#institutionName', { visible: true, timeout: 0 })
                await page.type('#institutionName', institutionName)

                await page.waitForSelector('#courseName', { visible: true, timeout: 0 })
                await page.type('#courseName', courseName)

                await page.waitForSelector('#qualification', { visible: true, timeout: 0 })
                await page.type('#qualification', qualification)

                await page.waitForSelector('#startDate_day', { visible: true, timeout: 0 })
                await page.type('#startDate_day', CourseStartDate.day)

                await page.waitForSelector('#startDate_month', { visible: true, timeout: 0 })
                await page.type('#startDate_month', CourseStartDate.month)

                await page.waitForSelector('#startDate_year', { visible: true, timeout: 0 })
                await page.type('#startDate_year', CourseStartDate.year)

                await page.waitForSelector('#endDate_day', { visible: true, timeout: 0 })
                await page.type('#endDate_day', CourseEndDate.day)

                await page.waitForSelector('#endDate_month', { visible: true, timeout: 0 })
                await page.type('#endDate_month', CourseEndDate.month)

                await page.waitForSelector('#endDate_year', { visible: true, timeout: 0 })
                await page.type('#endDate_year', CourseEndDate.year)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                if (!isOtherCourses) {
                  await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#addAnother_false').click())

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                } else {
                  await page.waitForSelector('#addAnother_true', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#addAnother_true').click())

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                }
                if (isPermissionATAS) {
                  await page.waitForSelector('#requirePermision_true', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#requirePermision_true').click())

                  await page.waitForSelector('#atasNumber', { visible: true, timeout: 0 })
                  await page.type('#atasNumber', AtasReferenceNumber)

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                } else {
                  await page.waitForSelector('#requirePermision_false', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#requirePermision_false').click())

                  await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                  await page.evaluate(() => document.querySelector('#submit').click())
                }
              } else {
                await page.waitForSelector('#enrolledInUKCourse_false', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#enrolledInUKCourse_false').click())

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#submit').click())

                if (isCourseLasting30days) {
                  await page.evaluate(() => document.querySelector('#courseNotLongerThan30Days_true').click())
                } else {
                  await page.evaluate(() => document.querySelector('#courseNotLongerThan30Days_false').click())
                }
              }
            } else if (selectedReasonForYourVisit == reasonForYourVisit.OTHER) {
            }
            console.log('wzzzzz')

            // const savedText = String(await humanizedText(summary));
            // console.log(savedText);
            await delay(5000)

            await page.waitForSelector('#details', { visible: true, timeout: 0 })
            await page.evaluate((summary) => {
              const input = document.querySelector('#details')
              if (input) {
                input.value = summary
                input.dispatchEvent(new Event('input', { bubbles: true }))
              }
            }, summary)

            console.log('wzzzzz')

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            //Partner info
            if (selectedMarriedStatus === RelationshipStatus.MARRIED) {
              await page.waitForSelector('#givenName', { visible: true, timeout: 0 })
              await page.type('#givenName', givenName)

              await page.waitForSelector('#familyName', { visible: true, timeout: 0 })
              await page.type('#familyName', familyName)

              await page.waitForSelector('#dateOfBirth_day', { visible: true, timeout: 0 })
              await page.type('#dateOfBirth_day', partnerDateOfBirth.day)

              await page.waitForSelector('#dateOfBirth_month', { visible: true, timeout: 0 })
              await page.type('#dateOfBirth_month', partnerDateOfBirth.month)

              await page.waitForSelector('#dateOfBirth_year', { visible: true, timeout: 0 })
              await page.type('#dateOfBirth_year', partnerDateOfBirth.year)

              await page.waitForSelector('#nationalityRef_ui', { visible: true, timeout: 0 })
              await page.type('#nationalityRef_ui', partnerCountry)

              if (liveWithYou) {
                await page.waitForSelector('#liveWithYou_true', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#liveWithYou_true').click())
              } else {
                await page.waitForSelector('#liveWithYou_false', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#liveWithYou_false').click())

                await page.waitForSelector('#address_line1', { visible: true, timeout: 0 })
                await page.type('#address_line1', partner_address_line1)

                await page.waitForSelector('#address_townCity', { visible: true, timeout: 0 })
                await page.type('#address_townCity', partner_address_townCity)

                await page.waitForSelector('#address_province', { visible: true, timeout: 0 })
                await page.type('#address_province', partner_address_province)

                await page.waitForSelector('#address_postalCode', { visible: true, timeout: 0 })
                await page.type('#address_postalCode', partner_address_postalCode)

                await page.waitForSelector('#address_countryRef_ui', { visible: true, timeout: 0 })
                await page.type('#address_countryRef_ui', partner_address_countryRef_ui)
              }
              if (travellingWithYou) {
                await page.waitForSelector('#travellingWithYou_true', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#travellingWithYou_true').click())

                await page.waitForSelector('#passportNumber', { visible: true, timeout: 0 })
                await page.type('#passportNumber', partnerPassportNumber)
              } else {
                await page.waitForSelector('#travellingWithYou_false', { visible: true, timeout: 0 })
                await page.evaluate(() => document.querySelector('#travellingWithYou_false').click())
              }

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            }
            if (hasDependants_described) {
              await page.waitForSelector('#value_true', { visible: true })
              await page.evaluate(() => document.querySelector('#value_true').click())

              await page.waitForSelector('#submit', { visible: true })
              await page.evaluate(() => document.querySelector('#submit').click())

              for (let i = 0; i < dependants.length; i++) {
                let dependant = dependants[i]
                await delay(2000)
                console.log(dependant)

                await page.waitForSelector('#relationship', { visible: true })
                await page.type('#relationship', dependant.relationship)

                await page.waitForSelector('#givenName', { visible: true })
                await page.type('#givenName', dependant.givenName)

                await page.waitForSelector('#familyName', { visible: true })
                await page.type('#familyName', dependant.familyName)

                await delay(1000)

                await page.waitForSelector('#dateOfBirth_day', { visible: true })
                await page.type('#dateOfBirth_day', dependant.dateOfBirth.day)

                await page.waitForSelector('#dateOfBirth_month', { visible: true })
                await page.type('#dateOfBirth_month', dependant.dateOfBirth.month)

                await page.waitForSelector('#dateOfBirth_year', { visible: true })
                await page.type('#dateOfBirth_year', dependant.dateOfBirth.year)
                console.log('test1')
                if (dependant.livingWithYou) {
                  await page.waitForSelector('#livingWithApplicant_true', { visible: true })
                  await page.evaluate(() => document.querySelector('#livingWithApplicant_true').click())
                  console.log('test2')
                } else {
                  await page.waitForSelector('#livingWithApplicant_false', { visible: true })
                  await page.evaluate(() => document.querySelector('#livingWithApplicant_false').click())
                  console.log('test2')
                }

                if (dependant.travellingWithYou) {
                  await page.waitForSelector('#travelling_true', { visible: true })
                  await page.evaluate(() => document.querySelector('#travelling_true').click())
                  await delay(1000)
                  console.log('test3')

                  await page.waitForSelector('#nationalityRef_ui', { visible: true })
                  await page.type('#nationalityRef_ui', 'Kazakhstan')
                  await delay(1000)

                  console.log('test4')

                  await page.waitForSelector('#passportNumber', { visible: true })
                  await page.type('#passportNumber', dependant.passportNumber)
                } else {
                  await page.waitForSelector('#travelling_false', { visible: true })
                  await page.evaluate(() => document.querySelector('#travelling_false').click())
                }

                await page.waitForSelector('#submit', { visible: true })
                await page.evaluate(() => document.querySelector('#submit').click())

                if (i < dependants.length - 1) {
                  // Нажимает "Add Another" только если это не последний зависимый
                  await page.waitForSelector('#addAnother_true', { visible: true })
                  await page.evaluate(() => document.querySelector('#addAnother_true').click())

                  await page.waitForSelector('#submit', { visible: true })
                  await page.evaluate(() => document.querySelector('#submit').click())
                }
              }

              console.log('Done')
              await page.waitForSelector('#addAnother_false', { visible: true })
              await page.evaluate(() => document.querySelector('#addAnother_false').click())

              await page.waitForSelector('#submit', { visible: true })
              await page.evaluate(() => document.querySelector('#submit').click())
            } else {
              await page.waitForSelector('#value_false', { visible: true })
              await page.evaluate(() => document.querySelector('#value_false').click())

              await page.waitForSelector('#submit', { visible: true })
              await page.evaluate(() => document.querySelector('#submit').click())
            }
            await page.waitForNavigation()

            await page.waitForSelector('#parent_relationshipRef_mother', { visible: true, timeout: 0 })
            await page.click('#parent_relationshipRef_mother')

            await page.waitForSelector('#parent_nationalityRef_ui', { visible: true, timeout: 0 })
            await page.type('#parent_nationalityRef_ui', mother_Country)

            await page.waitForSelector('#parent_givenName', { visible: true, timeout: 0 })
            await page.type('#parent_givenName', motherName)

            await page.waitForSelector('#parent_familyName', { visible: true, timeout: 0 })
            await page.type('#parent_familyName', mother_familyName)

            await page.waitForSelector('#parent_dateOfBirth_day', { visible: true, timeout: 0 })
            await page.type('#parent_dateOfBirth_day', mother_DateOfBirth.day)

            await page.waitForSelector('#parent_dateOfBirth_month', { visible: true, timeout: 0 })
            await page.type('#parent_dateOfBirth_month', mother_DateOfBirth.month)

            await page.waitForSelector('#parent_dateOfBirth_year', { visible: true, timeout: 0 })
            await page.type('#parent_dateOfBirth_year', mother_DateOfBirth.year)

            await page.waitForSelector('#parent_hadAlwaysSameNationality_true', {
              visible: true,
              timeout: 0,
            })
            await page.click('#parent_hadAlwaysSameNationality_true')

            await delay(2000)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            await page.waitForSelector('#parent_relationshipRef_father', { visible: true, timeout: 0 })
            await page.click('#parent_relationshipRef_father')

            await page.waitForSelector('#parent_nationalityRef_ui', { visible: true, timeout: 0 })
            await page.type('#parent_nationalityRef_ui', father_Country)

            await page.waitForSelector('#parent_givenName', { visible: true, timeout: 0 })
            await page.type('#parent_givenName', fatherName)

            await page.waitForSelector('#parent_familyName', { visible: true, timeout: 0 })
            await page.type('#parent_familyName', father_familyName)

            await page.waitForSelector('#parent_dateOfBirth_day', { visible: true, timeout: 0 })
            await page.type('#parent_dateOfBirth_day', father_DateOfBirth.day)

            await page.waitForSelector('#parent_dateOfBirth_month', { visible: true, timeout: 0 })
            await page.type('#parent_dateOfBirth_month', father_DateOfBirth.month)

            await page.waitForSelector('#parent_dateOfBirth_year', { visible: true, timeout: 0 })
            await page.type('#parent_dateOfBirth_year', father_DateOfBirth.year)

            await page.waitForSelector('#parent_hadAlwaysSameNationality_true', {
              visible: true,
              timeout: 0,
            })
            await page.click('#parent_hadAlwaysSameNationality_true')

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            console.log('SS')

            await page.waitForSelector('#value_false', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#value_false').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())
            console.log('SS')

            await page.waitForSelector('#isTravellingWithOtherPeople_false', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#isTravellingWithOtherPeople_false').click())

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.evaluate(() => document.querySelector('#submit').click())

            console.log('SS')

            let isTravelingWithAnotherPerson = false
            console.log('isTravelingWithAnotherPerson')

            if (isTravelingWithAnotherPerson) {
              await page.waitForSelector('#isTravellingWithSomeOneNotPartnerOrSpouse_true', {
                visible: true,
                timeout: 0,
              })
              await page.evaluate(() =>
                document.querySelector('#isTravellingWithSomeOneNotPartnerOrSpouse_true').click()
              )
              await page.waitForSelector('#givenName', { visible: true, timeout: 0 })
              await page.type('#givenName', givenNameFirst)

              await page.waitForSelector('#familyName', { visible: true, timeout: 0 })
              await page.type('#familyName', familyNameFirst)

              await page.waitForSelector('#nationalityRef_ui', { visible: true, timeout: 0 })
              await page.type('#nationalityRef_ui', 'Kazakhstan') //TODO:Change

              const optionValue = 'F' // TODO: Заменяй на нужное значение ('P', 'F', 'S', 'Fr', 'W', 'E', 'O')
              await page.select('#travellingWithOtherPeopleRelationshipStatusRef', optionValue)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            } else {
              console.log('isTravelingWithAnotherPerson false')

              await page.waitForSelector('#isTravellingWithSomeOneNotPartnerOrSpouse_false', {
                visible: true,
                timeout: 0,
              })
              await page.evaluate(() =>
                document.querySelector('#isTravellingWithSomeOneNotPartnerOrSpouse_false').click()
              )

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.evaluate(() => document.querySelector('#submit').click())
            }
            console.log('Ali')

            await page.waitForSelector('#value_true', { visible: true, timeout: 0 })
            await page.click('#value_true') // Выбираем радио-кнопку
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')

            for (let i = 0; i < hotels.length; i++) {
              const hotel = hotels[i]

              // Заполняем данные об отеле
              await page.waitForSelector('#name', { visible: true, timeout: 0 })

              await delay(3000)
              await page.type('#name', hotel.name)
              await page.type('#accommodationDetails_address_line1', hotel.address)
              await page.type('#accommodationDetails_address_townCity', hotel.city)
              await page.type('#accommodationDetails_address_postCode', hotel.postCode)
              await page.type('#accommodationDetails_dateRange_from_day', hotel.fromDay)
              await page.type('#accommodationDetails_dateRange_from_month', hotel.fromMonth)
              await page.type('#accommodationDetails_dateRange_from_year', hotel.fromYear)
              await page.type('#accommodationDetails_dateRange_to_day', hotel.toDay)
              await page.type('#accommodationDetails_dateRange_to_month', hotel.toMonth)
              await page.type('#accommodationDetails_dateRange_to_year', hotel.toYear)
              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')

              // Если есть ещё отели, нажимаем "Добавить ещё"
              if (i < hotels.length - 1) {
                await page.waitForSelector('#addAnother_true', { visible: true, timeout: 0 })
                await page.click('#addAnother_true')
                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.click('#submit')
                await page.waitForSelector('#name') // Ждём, пока появится новое поле для ввода
              } else {
                await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
                await page.click('#addAnother_false') // Если больше нет отелей, завершаем
              }
            }

            // Отправляем форму
            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')

            if (isBeeninUK) {
              await page.waitForSelector('#haveBeenToTheUK_true', { visible: true, timeout: 0 })
              await page.click('#haveBeenToTheUK_true')
              await page.type('#numberOfTimes', howManyTimesInUK)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')

              if (whyWereInUK === whyWereInUKTypes.OTHER) {
                await page.waitForSelector('#otherReason', { visible: true, timeout: 0 })
                await page.type('#otherReason', otherReason)
              }
              await page.type('#date_month', arrivalDate.month)
              await page.type('#date_year', arrivalDate.year)

              await page.select('#durationOfStayUnit', howLong.type)
              await page.type('#durationOfStay', howLong.amount)

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')

              if (isMedicalTreatment) {
                await page.waitForSelector('#haveYouHadTreatment_true', { visible: true, timeout: 0 })
                await page.click('#haveYouHadTreatment_true')

                if (hadToPay) {
                  await page.waitForSelector('#hadToPay_true', { visible: true, timeout: 0 })
                  await page.click('#hadToPay_true')
                  if (paidFullAmount) {
                    await page.waitForSelector('#paidFullAmount_true', { visible: true, timeout: 0 })
                    await page.click('#paidFullAmount_true')
                  }
                }
              }
            } else {
              await page.waitForSelector('#haveBeenToTheUK_false')
              await page.click('#haveBeenToTheUK_false')

              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')
            }

            await page.waitForSelector('#' + isTraveledCountries, { visible: true, timeout: 0 })
            await page.click('#' + isTraveledCountries)

            await page.waitForSelector('#submit', { visible: true, timeout: 0 })
            await page.click('#submit')

            if (isTraveledCountries === traveledToCountries.ZERO) {
            } else if (
              isTraveledCountries === traveledToCountries.ONE ||
              isTraveledCountries === traveledToCountries.TWO ||
              isTraveledCountries === traveledToCountries.SIX
            ) {
              console.log(JSON.stringify(travelDetails, null, 2))

              const sorted = travelDetails.sort((a, b) => {
                const dateA = parseInt(a.arrivalDate.year + a.arrivalDate.month, 10)
                const dateB = parseInt(b.arrivalDate.year + b.arrivalDate.month, 10)
                return dateA - dateB
              })

              // Берем последние 2 страны
              const lastTwo = sorted.slice(-2)

              console.log(JSON.stringify(lastTwo, null, 2))

              for (let travel of lastTwo) {
                await delay(5000)
                const validCountryRefs = [
                  'countryRef_australia',
                  'countryRef_canada',
                  'countryRef_newzealand',
                  'countryRef_usa',
                ]
                await page.evaluate(
                  ({ travel, validCountryRefs }) => {
                    if (validCountryRefs.includes(travel.country)) {
                      // Если страна уже указана как countryRef_*, кликаем по ней
                      document.querySelector('#' + travel.country)?.click()
                    } else {
                      // Если страна не в списке, выбираем Schengen и вводим название страны вручную
                      document.querySelector('#countryRef_schengen')?.click()
                      let input = document.querySelector('#schengenCountry_ui')
                      if (input) {
                        input.value = travel.country
                        input.dispatchEvent(new Event('input', { bubbles: true })) // Имитация ввода
                      }
                    }

                    // Выбираем причину поездки
                    document.querySelector('#reasonRef_tourist')?.click()

                    // Заполняем дату прибытия
                    let monthInput = document.querySelector('#date_month')
                    let yearInput = document.querySelector('#date_year')
                    if (monthInput) monthInput.value = travel.arrivalDate.month
                    if (yearInput) yearInput.value = travel.arrivalDate.year

                    // Заполняем длительность пребывания
                    let durationUnit = document.querySelector('#durationOfStayUnit')
                    let durationAmount = document.querySelector('#durationOfStay')
                    if (durationUnit) durationUnit.value = travel.howLong.type
                    if (durationAmount) durationAmount.value = travel.howLong.amount

                    // Триггерим событие изменения (на всякий случай)
                    durationUnit?.dispatchEvent(new Event('change', { bubbles: true }))
                    durationAmount?.dispatchEvent(new Event('input', { bubbles: true }))
                  },
                  { travel, validCountryRefs }
                )

                // Отправляем форму и ждем загрузки новой страницы
                await Promise.all([
                  page.waitForNavigation({ waitUntil: 'networkidle0' }),
                  page.evaluate(() => document.querySelector('#submit')?.click()),
                ])
              }
            }

            if (haveBeenOtherCountries) {
              await page.waitForSelector('#value_true')
              await page.click('#value_true')
              await delay(2000)
              await page.waitForSelector('#submit', { visible: true, timeout: 0 })
              await page.click('#submit')

              worldTravelCount = travels.length
              for (let i = 0; i < worldTravelCount; i++) {
                const travel = travels[i]
                await delay(2000)

                await page.waitForSelector('#whichCountry_ui', { visible: true, timeout: 0 })
                await page.type('#whichCountry_ui', travel.country)

                await delay(1000)
                await page.click(`#${travel.reason}`)
                await page.click(`#${travel.reason}`)
                await page.type('#visitStartDate_day', travel.startDate.day)
                await page.type('#visitStartDate_month', travel.startDate.month)
                await page.type('#visitStartDate_year', travel.startDate.year)

                await page.type('#visitEndDate_day', travel.endDate.day)
                await page.type('#visitEndDate_month', travel.endDate.month)
                await page.type('#visitEndDate_year', travel.endDate.year)

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.click('#submit')

                if (i === worldTravelCount - 1) {
                  // Если это последняя итерация, нажимаем value_false
                  await page.waitForSelector('#addAnother_false', { visible: true, timeout: 0 })
                  await page.click('#addAnother_false')
                } else {
                  // В остальных случаях нажимаем value_true
                  await page.waitForSelector('#addAnother_true', { visible: true, timeout: 0 })
                  await page.click('#addAnother_true')
                }

                await page.waitForSelector('#submit', { visible: true, timeout: 0 })
                await page.click('#submit')
              }

              console.log('Zdes111')
            } else {
              await page.waitForSelector('#value_false', { visible: true, timeout: 0 })
              await page.click('#value_false')
              await delay(2000)
              page.evaluate(() => document.querySelector('#submit')?.click())
            }

            console.log('Zdes')

            if (isImmigrated) {
              await page.waitForSelector('#value_true')
              await page.click('#value_true')

              await page.waitForSelector('#submit', { visible: true })
              await page.click('#submit')

              await page.waitForSelector('#submit', { visible: true })
              await page.click('#submit')

              await page.type('#countryForProblem_ui', countryForProblemOps)

              await page.type('#dateForProblem_month', dateForProblem.month)
              await page.type('#dateForProblem_year', dateForProblem.year)

              await page.type('#relevantInfoForProblem', relevantInfoProblem)

              await page.waitForSelector('#submit', { visible: true })
              await page.click('#submit')
            } else {
              console.log('Delayu')

              await page.waitForSelector('#value_false')
              await page.click('#value_false')

              console.log('I am here1')

              await page.waitForSelector('#submit', { visible: true })
              await page.click('#submit')

              console.log('I am here2')
            }

            console.log('I am here')
            await delay(5000)

            await page.waitForSelector('#value_false')
            await page.click('#value_false')

            await page.click('#submit')
            await page.waitForNavigation()

            await page.waitForSelector('#' + selectedConvictionType, { visible: true })
            await page.click('#' + selectedConvictionType)

            await page.waitForSelector('#submit', { visible: true })
            await page.click('#submit')

            if (selectedConvictionType === convictionTypeRefOps.GENERAL_CONVICTION) {
              await page.waitForSelector('#offence', { visible: true })
              await page.type('#offence', relevantInfoProblem)

              await page.type('#convictionDetails', relevantInfoProblem)

              await page.type('#sentencingDate_day', dateForProblem.month)
              await page.type('#sentencingDate_month', dateForProblem.year)
              await page.type('#sentencingDate_year', dateForProblem.year)

              await page.type('#countryRef_ui', dateForProblem.year)
            } else if (selectedConvictionType === convictionTypeRefOps.MOTORING_CONVICTION) {
              await page.waitForSelector('#' + selectedOffence, { visible: true })

              await page.type('#convictionDetails', relevantInfoProblem)

              await page.type('#sentencingDate_day', dateForProblem.month)
              await page.type('#sentencingDate_month', dateForProblem.year)
              await page.type('#sentencingDate_year', dateForProblem.year)

              await page.type('#countryRef_ui', dateForProblem.year)
            } else if (selectedConvictionType === convictionTypeRefOps.OUTSTANDING_CRIMINAL_PROCEEDING) {
              await page.waitForSelector('#convictionDetails', { visible: true })

              await page.type('#convictionDetails', relevantInfoProblem)

              await page.type('#arrestChargeReason', dateForProblem.month)

              await page.type('#countryRef_ui', dateForProblem.year)
            } else if (selectedConvictionType === convictionTypeRefOps.OFFICIAL_CAUTION) {
              await page.waitForSelector('#cautionTypeRef_caution', { visible: true })
              await page.click('#' + selectedСautionTypeRef)
              await page.type('#convictionDetails', relevantInfoProblem)

              await page.type('#sentencingDate_day', dateForProblem.month)
              await page.type('#sentencingDate_month', dateForProblem.year)
              await page.type('#sentencingDate_year', dateForProblem.year)

              await page.type('#countryRef_ui', dateForProblem.year)
            } else if (selectedConvictionType === convictionTypeRefOps.COURT_JUDGMENT) {
              await page.waitForSelector('#courtJudgmentRef', { visible: true })
              await page.type('#courtJudgmentRef', courtJudgmentRef)

              await page.type('#convictionDetails', relevantInfoProblem)

              await page.type('#sentencingDate_day', dateForProblem.month)
              await page.type('#sentencingDate_month', dateForProblem.year)
              await page.type('#sentencingDate_year', dateForProblem.year)

              await page.type('#countryRef_ui', dateForProblem.year)

              await page.click('#' + convictionTypeRefOps.COURT_JUDGMENT)
            } else if (selectedConvictionType === convictionTypeRefOps.CIVIL_PENALTY) {
              await page.waitForSelector('#courtJudgmentRef', { visible: true })

              await page.type('#civilPenaltyReason', civilPenaltyReason)

              await page.type('#convictionDetails', relevantInfoProblem)

              await page.type('#sentencingDate_day', dateForProblem.month)
              await page.type('#sentencingDate_month', dateForProblem.year)
              await page.type('#sentencingDate_year', dateForProblem.year)
            } else if (selectedConvictionType === convictionTypeRefOps.NONE) {
            }

            console.log('32323')

            await delay(7000)

            await page.click('#warCrimesInvolvement_false')

            //Terrorism
            await page.waitForSelector('#readAllInfo_iConfirm', { visible: true })
            await page.click('#readAllInfo_iConfirm')

            await page.click('#submit')

            await delay(5000)

            await page.click('#terroristActivitiesInvolvement_false')
            await page.click('#terroristOrganisationsInvolvement_false')
            await page.click('#terroristViewsExpressed_false')
            await page.click('#readAllInfo_iConfirm')

            await page.click('#submit')
            //Extremist organisations and views

            await delay(5000)

            await page.click('#extremistOrganisationsInvolvement_false')
            await page.click('#extremistViewsExpressed_false')
            await page.click('#readAllInfo_iConfirm')

            await page.click('#submit')

            //Person of good character
            await delay(5000)

            await page.click('#personOfGoodCharacter_false')
            await page.click('#otherActivities_false')
            await page.click('#anyOtherInfo_false')

            await page.click('#submit')

            //Your employment history
            await page.waitForSelector('#' + selectedEmploymentTypeRef, { visible: true })

            await page.click('#' + selectedEmploymentTypeRef)

            await page.click('#submit')

            const femaleEssays = [
              "I would love to see the UK's famous shopping sites, ranging from high-end department stores along Bond Street to antique stalls at Camden. Scouring for rare finds with a British touch would be a fantastic memory of my holiday. To shop inside these iconic establishments would make me part of the city's urban style.",
              'A traditional British afternoon tea at a quaint teahouse or a five-star hotel would be a nice and dignified experience. Drinking tea and eating pastries in the setting of antique British interiors would make me part of the past.',
              'Visiting art galleries like the Tate Modern and the National Gallery would give me an insight into the creativity and cultural heritage of the UK. Observing masterpieces of art up close would be enlightening and inspiring.',
              "A visit to charming markets like London's Borough Market would be an olfactory, gustatory, and visual delight. Gazing, inhaling, sampling, and touching local food, crafts, and culture at firsthand would be the key to better understanding everyday life in Britain.",
              'Having a stroll along the South Bank and viewing the River Thames and attractions like the London Eye and Tower Bridge would be a pleasant and rewarding experience.',
              "Going to Covent Garden with its street performers, shops, and craft stalls would familiarize me with the city's lively cultural scene.",
              "I would so love to visit Harrods, one of the world's finest luxury department stores, and behold its splendor and selectivity.",
              "Walking through Hyde Park, seeing the ducks glide in the Serpentine, and taking a peaceful moment amidst the city's hustle and bustle would be a wonderful way to unwind.",
              'Visiting the Victoria and Albert Museum to see exhibitions on fashion and design would be fascinating and inspiring, especially for someone who appreciates art and creativity.',
              "I would enjoy exploring Notting Hill's colorful streets, boutique shops, and the famous Portobello Road Market, known for its antiques and vintage items.",
            ]

            const maleEssays = [
              'I would really love to go to centuries-old British pubs. Drinking traditional ales in their historic surroundings would provide me with the real spirit of British culture.',
              "The UK's military past is overwhelming, and going to the Imperial War Museum or Churchill War Rooms would be very informative. Knowing about the UK's participation in major global events would be worth it.",
              "A trip to the Houses of Parliament and observing the UK's political system at work would make me more aware of its global influence. Glancing around the old debating chambers would be reflective and a sobering experience.",
              "I would love to see the London sites used in James Bond films and experience the thrill of the world's best spy's locations. Walking in the world's best spy's footsteps would be fantastic.",
              "A tour of the hotspots in London's Tech City and seeing the latest technology would expose me to the latest developments. Being aware of the UK's scientific and technological advancements would be inspiring.",
              'Tours around historic breweries and tasting British beers would be a great way of experiencing local life. Uncovering the brewing heritage would be interesting and enjoyable.',
              'Exploring the British Museum and studying ancient artifacts of different cultures would be inspiring and rewarding.',
              'Strolling around the world-renowned Wembley Stadium, a symbol of sporting history, would be an experience to never forget for a sports enthusiast.',
              'Visiting the Emirates Stadium or Stamford Bridge to see where legendary football clubs play would be a dream come true for a sport enthusiast.',
              'Walking through the financial district of Canary Wharf and observing the modern architecture and bustling business life would be impressive and eye-opening.',
            ]

            function getRandomEssay(gender) {
              if (gender === 'F') {
                return femaleEssays[Math.floor(Math.random() * femaleEssays.length)]
              } else if (gender === 'M') {
                return maleEssays[Math.floor(Math.random() * maleEssays.length)]
              } else {
                return "Invalid gender. Please specify 'M' or 'F'."
              }
            }

            // Пример использования
            const text = getRandomEssay(sex)

            //Additional information about your application
            await page.waitForSelector('#otherInformation', { visible: true })
            await page.type('#otherInformation', text)

            await delay(3000)
            await page.click('#submit')

            await delay(5000)
            await page.click('#submit')

            await page.waitForSelector('.save-for-later-link a')
            await page.click('.save-for-later-link a')

            // Ждём появления resumeLink
            await page.waitForSelector('#resumeLink')

            // Получаем ссылку
            const resumeLink = await page.$eval('#resumeLink', (el) => el.textContent.trim())

            console.log('Сохраненная ссылка:', resumeLink)

            // Отправляем в Telegram

            const bot = new Telegraf('7014191946:AAGDVNI2h1_03H_hG27uyAIK9bP2UuByDwo')

            // ID пользователя, которому отправляем ссылку
            const userId = 1399529997
            const userLink = `tg://user?id=${userId}`

            await bot.telegram
              .sendMessage(userId, `🔗 Сохраненная ссылка: ${resumeLink}`)
              .then(() => console.log('Сообщение отправлено'))
              .catch((err) => console.error('Ошибка отправки:', err))

            console.log('Бот запущен!')

            await page.close()
            console.log('Браузер закрыт!')
          } catch (error) {
            console.error('Ошибка в кластере:', error)
          }
        })

        res.json({ success: true, message: 'Script execution queued successfully' })
      } catch (error) {
        res.status(500).json({ error: 'An error occurred', details: error.message })
      }
    })
  } catch (e) {
    console.error('Ошибка инициализации кластера:', e)
    process.exit(1)
  }

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
})()

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time))

function generateRandomDate(startDate, minDays, maxDays) {
  const randomDays = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays
  const resultDate = new Date(startDate)
  resultDate.setDate(resultDate.getDate() + randomDays)
  return resultDate
}

function calculateDepartureDate(arrivalDate, minDays, maxDays) {
  const departureDays = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays
  const departureDate = new Date(arrivalDate)
  departureDate.setDate(departureDate.getDate() + departureDays)
  return departureDate
}

async function selectCheckbox(page, selector) {
  if ((await page.$(selector)) !== null) {
    const isChecked = await page.$eval(selector, (el) => el.checked)
    if (!isChecked) {
      await page.click(selector)
      console.log(`Выбран: ${selector}`)
    }
  }
}

function isLessThanTwoYears(selectedTime) {
  const now = new Date()
  const pastDate = new Date()

  if (selectedTime.unit === 'months') {
    pastDate.setMonth(now.getMonth() - selectedTime.number)
  } else if (selectedTime.unit === 'years') {
    pastDate.setFullYear(now.getFullYear() - selectedTime.number)
  } else if (selectedTime.unit === 'days') {
    return true
  }

  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(now.getFullYear() - 2)

  return pastDate > twoYearsAgo
}

function padZero(value) {
  return value.toString().padStart(2, '0')
}

const RelationshipStatus = {
  SINGLE: 'S',
  MARRIED: 'M',
  UNMARRIED: 'U',
  DIVORCED: 'D',
  SEPARATED: 'P',
  WIDOWED: 'W',
}

const TimeUnit = {
  DAYS: 'days',
  WEEKS: 'weeks',
  MONTHS: 'months',
  YEARS: 'years',
}

const EmploymentStatus = {
  EMPLOYED: 'status_employed',
  SELF_EMPLOYED: 'status_self-employed',
  STUDENT: 'status_student',
  RETIRED: 'status_retired',
  UNEMPLOYED: 'status_unemployed',
}

const statusOfOwnership = {
  OWNED: 'ownershipCategory_own',
  RENTED: 'ownershipCategory_rent',
  OTHER: 'ownershipCategory_other',
}

const statusesOfIncomeSaving = {
  OTHER_REGULAR_ADDITIONAL_INCOME: 'typeOfIncomeRefs_regularIncome',
  SAVINGS: 'typeOfIncomeRefs_moneyInBank',
  DONT_HAVE_ANY: '#hasNoOtherIncome',
}

const other_regular_additional_income_subtypes = {
  FROM_FAMILY: 'sourceRefs_allowance',
  PENSION: 'sourceRefs_pension',
  INVESTMENTS: 'sourceRefs_investments',
  OTHER: 'sourceRefs_other',
}

const whoWillBePayingVisit = {
  SOMEONE_I_KNOW: 'whoIsPayingRef_someoneIKnow',
  MY_EMPLOYER_OR_COMPANY: 'whoIsPayingRef_myEmployerOrCompany',
  ANOTHER_COMPANY_OR_ORGANISATION: 'whoIsPayingRef_otherEmployerOrCompany',
}

const reasonForYourVisit = {
  TOURISM: 'purposeRef_tourism',
  BUSINESS: 'purposeRef_business',
  TRANSIT: 'purposeRef_transit',
  ACADEMIC: 'purposeRef_academic',
  MARRIAGE: 'purposeRef_marriage',
  MEDICAL_TREATMENT: 'purposeRef_medicalTreatment',
  STUDY: 'purposeRef_study',
  OTHER: 'purposeRef_other',
}

const tourismSubtypes = {
  TOURIST: 'purposeRef_tourist',
  VISITING_FAMILY: 'purposeRef_visitingFamily',
  VISITING_FRIENDS: 'purposeRef_visitingFriends',
}

const businessSubtypes = {
  ATTEND_BUSINESS_MEEETING: 'purposeRef_meeting',
  RESEARCH_OR_FACT_FINDING: 'purposeRef_research',
  BUSINESS_RELATED_TRAINING: 'purposeRef_jobTraining',
  ATTEND_LECTURE: 'purposeRef_lectures',
  PERFORM_ENTERTAIMENT_EVENT: 'purposeRef_entertainmentEvent',
  PERFORM_SPORTING_EVENT: 'purposeRef_sportEvent',
  RELIGIOUS_ACTIVITIES: 'purposeRef_religious',
  SECURE_FUNDING: 'purposeRef_secureFunding',
  PLAB: 'purposeRef_plab',
  CLINICAL_ATTACHMENTS: 'purposeRef_clinicalAttachments',
  PPE: 'purposeRef_ppe',
  OTHER: 'purposeRef_other',
}

const transitSubtypes = {
  VISITOR_IN_TRANSIT: 'purposeRef_visitorInTransit',
  DIRECT_AIRSIDE_TRANSIT: 'purposeRef_directAirsideTransit',
  JOIN_SHIP_OR_AIRCRAFT: 'purposeRef_joinAShipAircraft',
}

const ppeSubtypes = {
  STUDENT_EXAMINER: 'activityRef_studentExaminer',
  SELECTION_PANEL: 'activityRef_selectionPanel',
  LECTURER: 'activityRef_lecturer',
  UK_BASED_PILOTS: 'activityRef_ukBasedPilots',
  ADVOCACY_IN_LAW: 'activityRef_advocacyInLaw',
  ARTS_ON_ENTERTAIMENT: 'activityRef_artsOnEntertainment',
  FASHION_MODELLINGS: 'activityRef_fashionModelling',
  CONFERENCE_SEMINAR: 'activityRef_conferenceSeminar',
}

const statusWhyGoingToThisCountry = {
  TOURISM: 'purposeOfTravel_tourism',
  BUSINESS: 'purposeOfTravel_business',
  VISIT_FAMILY: 'purposeOfTravel_visitFamily',
  RETURNING_TO_MY_COUNTRY: 'purposeOfTravel_returningToMyCountryOfNationality',
  OTHER: 'purposeOfTravel_other',
}

const IncomeType = {
  REGULAR_INCOME: 'typeOfIncomeRefs_regularIncome',
  SAVINGS: 'typeOfIncomeRefs_moneyInBank',
}

// Enum для источников дохода (только для REGULAR_INCOME)
const RegularIncomeSources = {
  ALLOWANCE: 'sourceRefs_allowance',
  PENSION: 'sourceRefs_pension',
  INVESTMENTS: 'sourceRefs_investments',
  OTHER: 'sourceRefs_other',
}

const RelativePermissions = {
  TEMPORARY: 'ukImmigrationStatus_immigrationStatusTypeRef_temporaryVisa',
  PERMANENT: 'ukImmigrationStatus_immigrationStatusTypeRef_permanentResident',
  OTHER: 'ukImmigrationStatus_immigrationStatusTypeRef_other',
  CANNOT: 'ukImmigrationStatus_immigrationStatusTypeRef_cannotContact',
}

let email = 'abi_sana@gmail.com'
let password = 'P@SSword!123'

let telephoneNumber = '7777777777'

let givenNameFirst = 'Sana'
let familyNameFirst = 'Abi'

let isNameChanged = false
// if true
let givenNameSecond = 'Sana'
let familyNameSecond = 'Abi'
//
let sex = 'M'

let selectedMarriedStatus = RelationshipStatus.MARRIED

let outOfCountryAddress = 'astana botan'
let outOfCountryAddress2Optional = 'astana botan'
let outOfCountryAddress3Optional = 'astana botan'
let townCity = 'astana'
let provinceRegionStateOptional = 'astana'
let postalCode = 'AB1 0AA'
let countryRef = 'Kazakhstan'
let isThisCorrespondenceAddress = true // ? if false handle it || expexted true ALL TIME

// how long have you lived at this address
let selectedTime = { number: '3', unit: TimeUnit.MONTHS }
let statusOfOwnershipHome = statusOfOwnership.OWNED
// if other then describe
let otherDescHome = 'my choose'

let isUkAddress = true
// if true
let ukAddress_line1 = 'astana botan'
let ukAddress_townCity = 'astana'
let ukAddress_lookupPostCode = 'AB1 0AA'
let startDateAtAddress = { month: '02', year: '2019' }
let endDateAtAddress = { month: '04', year: '2020' }
// if false
let overseasAddress_line1 = 'astana botan'
let overseasAddress_townCity = 'astana'
let overseasRegion = 'astana'
let overseasPostCode = 'AB1 0AA'
//

//
let anotherAddressPast2Years = false // expected false ALL TIME

let passportNumber = '123456789'
let issuingAuthority = 'Astana'
let issueDate = { day: '01', month: '01', year: '2020' }
let expiryDate = { day: '01', month: '01', year: '2030' }

//
let passportId = '123456789'
let issuingAuthorityId = 'Astana'
let issueDateId = { day: '01', month: '01', year: '2020' }
let expiryDateId = { day: '01', month: '01', year: '2030' }
//

let nationality = 'Kazakhstan'
let countryOfBirth = 'Kazakhstan'
let placeOfBirth = 'Astana'
let dateOfBirth = { day: '01', month: '01', year: '2000' }
let otherNationality = false
let selectedStatuses = [EmploymentStatus.STUDENT]
// if employed
let employerName = 'Astana'
let employerAddress = 'Astana'
let employerCity = 'Astana'
let employerState = 'Astana'
let employerPostCode = 'AB1 0AA'
let employerCountry = 'Kazakhstan'
let employerPhone = { code: '7', number: '7777777777' }
let workingDate = { month: '01', year: '2020' }

let jobTitle = 'Astana'
let earnValute = 'GBP'
let earnAmount = '1000'
let jobDescription = 'Astana'

let selectedStatusesOfIncomeSaving = [
  statusesOfIncomeSaving.OTHER_REGULAR_ADDITIONAL_INCOME,
  statusesOfIncomeSaving.SAVINGS,
]
let selectedOtherRegularAdditionalIncome = [
  other_regular_additional_income_subtypes.FROM_FAMILY,
  other_regular_additional_income_subtypes.PENSION,
  other_regular_additional_income_subtypes.INVESTMENTS,
  other_regular_additional_income_subtypes.OTHER,
]

// Will anyone be paying towards the cost of your visit?
let payingForYourVisit = true
let whoWillBePaying = whoWillBePayingVisit.SOMEONE_I_KNOW

// if someone i know or another company or organisation
let payeeName = 'Astana'
let address_line1 = 'Astana'
let address_line2 = 'Astana'
let address_line3 = 'Astana'
let address_townCity = 'Astana'
let address_province = 'Astana'
let address_postalCode = 'AB1 0AA'
let address_countryRef_ui = 'Kazakhstan'

// МЕНЯТЬ СМЫСЛА НЕТ, ТАМ ВСЕГДА GBP И РАНДОМНОЕ ЧИСЛО
let choosenValue = 'GBP'
let choosenAmount = 'random'

let descriptionWhyAreTheyHelping = 'Astana'

// ВСЕГДА ФАЛСЕ ВТОРОЙ РАЗ НЕ HANDLE

const today = new Date()

// ЕСЛИ ПЕРЕДАВАЕМЫЕ ДАТЫ НУЖНО ПРЕОБРАЗОВАТЬ В СТРОКУ
const arrivalDay = '5'
const arrivalMonth = '3'
const arrivalYear = '2025'
const departureDay = '6'
const departureMonth = '4'
const departureYear = '2025'

let selectedReasonForYourVisit = reasonForYourVisit.TOURISM
console.log(selectedReasonForYourVisit)
// if tourism then choose reason
let selectedTourismSubtype = tourismSubtypes.TOURIST
// if business
let selectedBusinessSubtype = businessSubtypes.PPE
let willYouPaidWhileInTheUK = true
//if true
let whoWillPaying = 'astana'
let howMuchValue = 'GBP'
let howMuchAmount = '5000'
let whatBeingPaidFor = 'Astana'
// if ppe in business
let selectedPPESubtype = ppeSubtypes.STUDENT_EXAMINER
let whoWillPaidBy = 'Astana'
// if other in business
let otherDesc = 'Astana'
// if transit
let selectedTransitSubtype = transitSubtypes.VISITOR_IN_TRANSIT
let placeOfArrivalInUk = 'Astana'
let transportReference = 'Astana'
let placeOfDeparture = 'Astana'
let transportReference2 = 'Astana'
let whichCountryTravellingFromTheUK = 'Kazakhstan'
let whyGoingToThisCountry = statusWhyGoingToThisCountry.OTHER
let selectedIncomeTypes = [IncomeType.REGULAR_INCOME, IncomeType.SAVINGS]
let selectedRegularIncomeSources = ['ALLOWANCE', 'OTHER']

// if other then describe
let otherDescWhyGoingToThisCountry = 'Astana'
let whyTravellingThroughTheUK = 'Astana'
let doYouHaveValidVisa = true
// if true fill the following fields
let residencePermitRef = 'Astana'
let dateOfIssueVisa = { day: '01', month: '01', year: '2024' }
let whereWasVisaIssued = 'Astana'
//if ship
let organisationOrAgent = 'Astana'
let dateOfDeparture_day = '01'
let dateOfDeparture_month = '01'
let dateOfDeparture_year = '2026'
let placeOfDepartureInUk = 'Astana'
let transportReferenceShip = 'Astana'
let workAboardTransport = 'Astana'
let willYouPaidActivitiesWhileInTheUK = true
// if true
let payerShip = 'Astana'
let howMuchValueShip = 'GBP'
let howMuchAmountShip = '5000'
let whatBeingPaidForShip = 'Astana'

// if study
let isEnrolledUKCourse = true
let isCourseLasting30days = true
let institutionName = 'Cambridge'
let courseName = 'IT'
let qualification = 'Engineer'
let CourseStartDate = { day: '01', month: '12', year: '2025' }
let CourseEndDate = { day: '01', month: '01', year: '2029' }
let isOtherCourses = false
let other_institutionName = 'Cambridge'
let other_courseName = 'IT'
let other_qualification = 'Engineer'
let other_CourseStartDate = { day: '01', month: '01', year: '2020' }
let other_CourseEndDate = { day: '01', month: '01', year: '2020' }
let isPermissionATAS = true
let AtasReferenceNumber = '123123'
let activities = 'Active'

//Partner info
let givenName = 'Alaska'
let familyName = 'Adams'
let partnerDateOfBirth = { day: '01', month: '01', year: '2002' }
let partnerCountry = 'Kazakhstan'
let liveWithYou = true
let partner_address_line1 = 'Astana'
let partner_address_townCity = 'Astana'
let partner_address_province = 'Astana'
let partner_address_postalCode = '05231'
let partner_address_countryRef_ui = 'Kazakhstan'
let travellingWithYou = true
let partnerPassportNumber = '123123'

//Depended
let dependants = [
  {
    givenName: 'John',
    familyName: 'Doe',
    dateOfBirth: { day: '01', month: '01', year: '2002' },
    relationship: 'brother',
    livingWithYou: true,
    travellingWithYou: true,
    passportNumber: '123123',
    partnerPassportNumber: '123123',
    country: 'Kazakhstan',
  },
]
let hasDependants_described = true
let dependants_relationship = 'bratha'
let dependants_givenName
let dependants_familyName
let dependants_DateOfBirth = { day: '01', month: '01', year: '2002' }
let dependants_travellingWithYou = true
let dependants_passportNumber = '123123'
let dependants_Country = 'Kazakhstan'
let dependants_passportNumber1 = '123123'

//Parents
let motherName = 'Alaska'
let mother_familyName = 'ABu'
let mother_DateOfBirth = { day: '01', month: '01', year: '2002' }
let mother_Country = 'Kazakhstan'
let isMotherSameCountry = true
let mother_BornCountry = 'Kazakhstan'
let fatherName = 'Alaska'
let father_familyName = 'ABu'
let father_DateOfBirth = { day: '01', month: '01', year: '2002' }
let father_Country = 'Kazakhstan'
let isFatherSameCountry = true
let father_BornCountry = 'Kazakhstan'

//Family in UK
let isFamilyInUK = true
let relative_relationship = 'Brother'
let relative_Name = 'Alaska'
let relative_familyName = 'ABu'
let relative_DateOfBirth = { day: '01', month: '01', year: '2002' }
let relative_passportNumber = '123123'
let relative_other = 'Other'
let relative_cannot = 'Cannot'

//Organized

//UK travel history
let isBeeninUK = false
let howManyTimesInUK = 2

const whyWereInUKTypes = {
  TOURISM: 'reasonRef_tourist',
  WORK: 'reasonRef_business',
  STUDY: 'reasonRef_study',
  TRANSIT: 'reasonRef_transit',
  OTHER: 'reasonRef_other',
}

let whyWereInUK = whyWereInUKTypes.TOURISM
let otherReason = 'Other'

let arrivalDate = { month: '01', year: '2002' }
let howLong = { type: 'days', amount: '2' }
let isMedicalTreatment = true
let hadToPay = true
let paidFullAmount = true

//Travel to Australia, Canada, New Zealand, USA, Switzerland or the European Economic Area
const traveledToCountries = {
  ZERO: 'bandRef_0',
  ONE: 'bandRef_1',
  TWO: 'bandRef_2', //2-5
  SIX: 'bandRef_6',
}
let isTraveledCountries = traveledToCountries.ZERO

const countriesOps = {
  AUSTRALIA: 'countryRef_australia',
  CANADA: 'countryRef_canada',
  NEWZEALAND: 'countryRef_newzealand',
  USA: 'countryRef_usa',
  SCHENGED: 'countryRef_schengen',
}

const reasonOps = {
  TOURISM: 'reasonRef_tourist',
  WORK: 'reasonRef_business',
  STUDY: 'reasonRef_study',
  TRANSIT: 'reasonRef_transit',
  OTHER: 'reasonRef_other',
}
let travelDetails = [
  {
    arrivalDate: { month: '01', year: '2002' },
    howLong: { type: 'days', amount: '2' },
    country: countriesOps.CANADA,
    reason: reasonOps.TOURISM,
  },
]
//World travel history
let haveBeenOtherCountries = false
let worldTravelCount = 1
let worldCountryTravel = 'Kyrgyzstan'

const world_reasonOps = {
  TOURISM: 'reasonForVisit_tourism',
  WORK: 'reasonForVisit_business',
  STUDY: 'reasonForVisit_study',
  TRANSIT: 'reasonForVisit_transit',
  OTHER: 'reasonForVisit_other',
}
let worldReason = world_reasonOps.TOURISM
let visit_startDate = { day: '01', month: '01', year: '2020' }
let visit_endDate = { day: '01', month: '01', year: '2024' }
const travels = [
  {
    country: 'Kyrgyzstan',
    reason: world_reasonOps.TOURISM,
    startDate: { day: '01', month: '01', year: '2020' },
    endDate: { day: '01', month: '01', year: '2024' },
  },
]

//Immigration history
let isImmigrated = false
const reasonForProblemOps = {
  VISA_REFUSED: 'reasonForProblem_visaRefused',
  REFUSED_ENTRY: 'reasonForProblem_refusedEntry',
  REFUSED_PERMISSION: 'reasonForProblem_refusedPermission',
  REFUSED_ASYLUM: 'reasonForProblem_refusedAsylum',
  DEPORTED: 'reasonForProblem_deported',
  REMOVED: 'reasonForProblem_removed',
  REQUIRED_TO_LEAVE: 'reasonForProblem_requiredToLeave',
  BANNED_FROM_ENTRY: 'reasonForProblem_bannedFromEntry',
}
let countryForProblemOps = 'Japan'
let dateForProblem = { month: '01', year: '2023' }
let relevantInfoProblem = 'Details'
//Breach of UK immigration law
let isBreakedImmigration = false

//Convictions and other penalties

const convictionTypeRefOps = {
  GENERAL_CONVICTION: 'convictionTypeRef_generalConviction',
  MOTORING_CONVICTION: 'convictionTypeRef_motoringConviction',
  OUTSTANDING_CRIMINAL_PROCEEDING: 'convictionTypeRef_outstandingCriminalProceeding',
  OFFICIAL_CAUTION: 'convictionTypeRef_officialCaution',
  COURT_JUDGMENT: 'convictionTypeRef_courtJudgment',
  CIVIL_PENALTY: 'convictionTypeRef_civilPenalty',
  NONE: 'convictionTypeRef_none',
}

let gen_offence = ''

const motoringOffenceRef = {
  speeding: 'motoringOffenceRef_speeding',
  noInsurance: 'motoringOffenceRef_noInsurance',
  other: 'motoringOffenceRef_other',
}
let selectedOffence = motoringOffenceRef.speeding
let selectedConvictionType = convictionTypeRefOps.NONE

const cautionTypeRef = {
  caution: 'cautionTypeRef_caution',
  warning: 'cautionTypeRef_warning',
  fixedPenalty: 'cautionTypeRef_fixedPenalty',
  other: 'cautionTypeRef_other',
}

let selectedСautionTypeRef = cautionTypeRef.caution

let courtJudgmentRef = 'Judge, jurry executioneer'

let civilPenaltyReason = 'No reason'

//War crimes
let isWarCrime = false
let warCrimesDetails = 'details'

//Terrorism

let terroristActivitiesInvolvement = false
let terroristActivitiesDetails = ';'

let terroristOrganisationsInvolvement = false
let terroristOrganisationsDetails = 'asd'

let terroristViewsExpressed = false
let terroristViewsDetails = 'asd'

//Extremist organisations and views

let extremistOrganisationsInvolvement = false
let extremistViewsExpressed = false

//Person of good character

let personOfGoodCharacter = false
let otherActivities = false
let anyOtherInfo = false

//Your employment history
const employmentTypeRef = {
  armedForcesCareer: 'armedForcesCareer_armedForcesCareer',
  armedForcesCompulsory: 'armedForcesCompulsory_armedForcesCompulsory',
  government: 'government_government',
  intelligence: 'intelligence_intelligence',
  security: 'security_security',
  media: 'media_media',
  judiciary: 'judiciary_judiciary',
  none: 'none_none',
}

let selectedEmploymentTypeRef = employmentTypeRef.none

//Additional information about your application

let otherInformation = 'asdasd'

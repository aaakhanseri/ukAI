import puppeteer from 'puppeteer';
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

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
                             phoneNumber
                         }) {
    let browser;
    try {
        const cityData = {
            'London': '2280',
            'Manchester City Centre': '1077',
            'Edinburgh City Centre': '17250'
        };
        let destId = cityData[city] || '2280';
        let minBudget = parseInt(budgetMin, 10);
        let maxBudget = parseInt(budgetMax, 10);
        const maxRetries = 8;
        let attempt = 0;

        const launchBrowser = async () => {
            browser = await puppeteer.launch({
                headless: false,
                slowMo: 25,
                defaultViewport: null,
                args: ["--start-maximized"]
            });

            console.log("Браузер запущен!");

        };

        const searchHotel = async () => {
            const page = await browser.newPage();

            const baseUrl = 'https://www.booking.com/searchresults.en-gb.html';
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
                nflt: `ht_id=204;class=4;class=5;fc=2;price=EUR-${minBudget}-${maxBudget}-1`
            });

            const url = `${baseUrl}?${params.toString()}`;
            console.log(`Переходим по ссылке: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            const hotelSelector = 'div[data-testid="property-card"] a[data-testid="title-link"]';
            await page.waitForSelector(hotelSelector, { timeout: 10000 });

            const hotelLink = await page.evaluate(() => {
                const elements = document.querySelectorAll('div[data-testid="property-card"] a[data-testid="title-link"]');
                return elements.length > 1 ? elements[1].href : null; // Выбираем второй отель
            });

            if (!hotelLink) throw new Error("Не найден второй отель.");

            console.log(`Открываем второй отель: ${hotelLink}`);
            await page.goto(hotelLink, { waitUntil: 'networkidle2' });

            await page.goto(hotelLink, { waitUntil: 'networkidle2' });

            await page.waitForSelector('.hprt-nos-select.js-hprt-nos-select', { timeout: 10000 });

            await page.evaluate(() => {
                const select = document.querySelector('.hprt-nos-select.js-hprt-nos-select');
                if (select) {
                    select.value = '1';
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            await page.waitForSelector('.bui-button__text.js-reservation-button__text', { timeout: 10000 });
            await page.evaluate(() => {
                const button = document.querySelector('.bui-button__text.js-reservation-button__text');
                if (button) button.click();
            });

            await delay(9000);

            await page.waitForSelector('input[name="firstname"]', { timeout: 10000 });
            await page.type('input[name="firstname"]', firstName);
            await page.type('input[name="lastname"]', lastName);
            await page.type('input[name="email"]', email);
            const emailConfirmSelector = 'input[name="emailConfirm"]';
            const emailConfirmField = await page.$(emailConfirmSelector);
            if (emailConfirmField) {
                await page.type(emailConfirmSelector, email);
                console.log("Поле подтверждения электронной почты заполнено.");
            }
            const phoneConfirmSelector = 'input[name="phone__number"]';
            const phoneConfirm = await page.$(phoneConfirmSelector);
            if (phoneConfirm) {
                await page.type(phoneConfirmSelector, phoneNumber);
                console.log("Поле подтверждения электронной почты заполнено.");
            }

            const ps = 'input[name="phoneNumber"]';
            const phoneConfirmSecond = await page.$(ps);
            if (phoneConfirmSecond) {
                await page.type(ps, phoneNumber);
                console.log("Поле подтверждения электронной почты заполнено.");
            }




            // Check if the first select element exists and select the option 'kz'
            const phoneCountry = await page.$('select[name="phone__country"]');
            if (phoneCountry) {
                await page.select('select[name="phone__country"]', 'kz');
            }

// Check if the second select element exists and select the option 'kz'
            const cc1 = await page.$('select[name="cc1"]');
            if (cc1) {
                await page.select('select[name="cc1"]', 'kz');


            }
            // Check if the 'address1' input exists and fill it
            const addressInput = await page.$('input[name="address1"]');
            if (addressInput) {
                await page.type('input[name="address1"]', 'Your Address Here');
            } else {
                console.log('Address input not found');
            }

// Check if the 'city' input exists and fill it
            const cityInput = await page.$('input[name="city"]');
            if (cityInput) {
                await page.type('input[name="city"]', 'Your City Here');
            } else {
                console.log('City input not found');
            }





// Check if the submit button exists and is visible, then click it
            const sbb = await page.$('button[type="submit"]');
            if (sbb) {
                await page.waitForSelector('button[type="submit"]', { visible: true });
                await sbb.click();
            } else {
                console.log('Submit button not found');
            }

            console.log("Данные успешно введены и отправлены!");

            await page.waitForNavigation();

            await delay(3000);

            const buttonExists = await page.$("button[data-testid='double-booking-modal-confirm-button']");

            if (buttonExists) {
                await page.evaluate(() => {
                    const button = document.querySelector("button[data-testid='double-booking-modal-confirm-button']");
                    if (button) {
                        button.click();
                        console.log('Кнопка "Да, продолжить" нажата.');
                    }
                });
            } else {
                console.log('Кнопка "Да, продолжить" не найдена.');
            }


// Wait for the element to be available before interacting with it
            const rejectButton = await page.$('#onetrust-reject-all-handler');
            if (rejectButton) {
                await rejectButton.click();
                console.log('Button clicked');
            } else {
                console.log('Button not found');
            }

            await page.waitForSelector('input[name="payment-timing"][value="PAY_TO_PROPERTY"]', { timeout: 5000 })
                .catch(async () => {
                    console.log('"PAY_TO_PROPERTY" не найден, пробуем "PAY_LATER".');
                    const payLaterOption = await page.$('input[name="payment-timing"][value="PAY_LATER"]');
                    if (payLaterOption) {
                        await payLaterOption.click();
                    } else {
                        console.log('Ни одна из опций не найдена.');
                        throw new Error("Не найдены способы оплаты. Пробуем следующую попытку.");
                    }
                });

            await page.evaluate(() => {
                const paymentOption = document.querySelector('input[name="payment-timing"][value="PAY_TO_PROPERTY"]');
                if (paymentOption) {
                    paymentOption.click();
                }
            });




            const paymentFrame = page.frames().find(frame => frame.url().includes('paymentcomponent.booking.com'));

            if (paymentFrame) {
                await paymentFrame.evaluate(() => {
                    const fillField = (selector, value) => {
                        const field = document.querySelector(selector);
                        if (field) {
                            field.value = value;
                            field.dispatchEvent(new Event('input', { bubbles: true }));
                            field.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    };

                    fillField('input[name="name"]', "Ali Akhanseriyev");
                    fillField('input[autocomplete="cc-number"]', "4400430269922719");
                    fillField('input[autocomplete="cc-exp"]', "07/25");
                    fillField('input[autocomplete="cc-csc"]', "555");
                });
            } else {
                console.log('Фрейм с title "Payment" не найден');
            }

            // Check if the 'book' button exists and is visible, then click it
            const bookButton = await page.$('button[name="book"]');
            if (bookButton) {
                await page.waitForSelector('button[name="book"]', { visible: true });
                await page.click('button[name="book"]');
            }

// Check if the 'submit' button exists and is visible, then click it
            const submitButton = await page.$('button[type="submit"]');
            if (submitButton) {
                await page.waitForSelector('button[type="submit"]', { visible: true });
                await page.click('button[type="submit"]');
            }

            await delay(25000);

            await page.waitForSelector('button[aria-label="Close modal"]');

            // Клик по кнопке закрытия
            await page.click('button[aria-label="Close modal"]');

            await delay(8000);


            async function clickButton() {
                do {
                    // 1. Пробуем найти и нажать "изменить или отменить"
                    const clicked1 = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll("button"));
                        const targetButton = buttons.find(btn =>
                            btn.textContent.trim().toLowerCase().includes("изменить или отменить")
                        );

                        if (targetButton) {
                            targetButton.click();
                            console.log('Кнопка "изменить или отменить" нажата.');
                            return true;
                        }
                        return false;
                    });

                    if (clicked1) break; // Если нажали "изменить или отменить" → выход

                    // 2. Если "изменить или отменить" не найдена, ищем "Посмотреть или обновить данные"
                    console.log('Кнопка "изменить или отменить" не найдена. Ищем "Посмотреть или обновить данные"...');
                    const clicked2 = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll("button"));
                        const targetButton = buttons.find(btn =>
                            btn.textContent.trim() === "Посмотреть или обновить данные"
                        );

                        if (targetButton) {
                            targetButton.click();
                            console.log('Кнопка "Посмотреть или обновить данные" нажата.');
                            return true;
                        }
                        return false;
                    });

                    // 3. Если "Посмотреть или обновить данные" была нажата → снова ищем "изменить или отменить"
                    if (clicked2) {
                        console.log('Теперь снова ищем "изменить или отменить"...');
                        await new Promise(resolve => setTimeout(resolve, 3000)); // Ждём 3 сек перед повтором
                        continue;
                    }

                    // 4. Если обе кнопки не найдены, ждём 5 секунд и повторяем поиск
                    console.log("Кнопки не найдены, пробуем снова через 5 секунд...");
                    await new Promise(resolve => setTimeout(resolve, 5000));

                } while (true); // Повторяем, пока не нажмём "изменить или отменить"
            }

// Запускаем функцию
            await clickButton();







            await delay(15000);


            await page.waitForFunction(() => {
                const address = document.querySelector('.mb-info--content.mb-hotel-info__address-details');
                const confirmationParagraphs = document.querySelectorAll('p');
                const dateElements = document.querySelectorAll('[data-testid="PostBookingCheckinCheckout"] time .e1eebb6a1e.b80bba4aba');

                return address && confirmationParagraphs.length > 0 && dateElements.length > 1;
            }, { timeout: 10000 }); // Ожидаем до 10 секунд, пока элементы не будут найдены

// Собираем данные после загрузки
            const bookingDetails = await page.evaluate(() => {
                const getText = (selector) => document.querySelector(selector)?.innerText.trim() || '';

                const address = getText('.mb-info--content.mb-hotel-info__address-details');

                // Ищем номер подтверждения и пин-код по тексту внутри <p>
                const confirmationParagraphs = Array.from(document.querySelectorAll('p'));
                let confirmationNumber = '';
                let pinCode = '';

                confirmationParagraphs.forEach((p) => {
                    if (p.textContent.includes('Номер подтверждения:')) {
                        confirmationNumber = p.querySelector('strong')?.innerText.trim() || '';
                    }
                    if (p.textContent.includes('Пин-код:')) {
                        pinCode = p.querySelector('strong')?.innerText.trim() || '';
                    }
                });

                // Даты заезда и выезда
                const dateElements = document.querySelectorAll('[data-testid="PostBookingCheckinCheckout"] time .e1eebb6a1e.b80bba4aba');
                const checkinDate = dateElements[0]?.innerText.trim() || '';
                const checkoutDate = dateElements[1]?.innerText.trim() || '';

                const hotelLink = document.querySelector('[data-testid="name-archor"]');
                let name = hotelLink ? hotelLink.innerText.trim() : null;


                function splitAddress(address) {
                    // Убираем лишние переносы строк
                    const cleanedAddress = address.replace(/\n/g, ', ').trim();

                    const regex = /^(.*?),\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}),?\s*(United Kingdom)?$/i;
                    const match = cleanedAddress.match(regex);

                    if (match) {
                        return {
                            address: match[1].trim(),
                            postalCode: match[2].trim()
                        };
                    } else {
                        return {
                            address: cleanedAddress,
                            postalCode: 'Не найден'
                        };
                    }
                }
                const result = splitAddress(address);
                const road = result.address;
                const postCode = result.postalCode;





                return { road,postCode, confirmationNumber, pinCode, checkinDate, checkoutDate, name };
            });

            console.log(bookingDetails);
            return { bookingDetails, currentUrl: await page.url() };
        };

        await launchBrowser();

        while (attempt < maxRetries) {
            try {
                console.log(`Попытка ${attempt + 1} с бюджетом: ${minBudget}-${maxBudget} EUR`);
                const result = await searchHotel();
                console.log("Бронирование завершено успешно:", result);
                await browser.close();
                return result;
            } catch (error) {
                console.error(`Ошибка при попытке ${attempt + 1}:`, error);
                if (attempt + 1 < maxRetries) {
                    minBudget += 30;
                    maxBudget += 30;
                    console.log(`Увеличиваем бюджет на 30 EUR: ${minBudget}-${maxBudget}`);
                } else {
                    console.error("Достигнуто максимальное количество попыток.");
                }
                attempt++;
            }
        }
    } catch (error) {
        console.error("Общая ошибка:", error);
    } finally {
        if (browser) await browser.close();
    }
}

function extractHotelsAndSummary(tourData) {
    const monthMap = {
        "января": "01", "февраля": "02", "марта": "03", "апреля": "04",
        "мая": "05", "июня": "06", "июля": "07", "августа": "08",
        "сентября": "09", "октября": "10", "ноября": "11", "декабря": "12"
    };

    const hotels = tourData.trip.hotels.map(hotel => {
        const checkinParts = hotel.bookingDetails.checkinDate.split(" ");
        const checkoutParts = hotel.bookingDetails.checkoutDate.split(" ");

        return {
            name: hotel.bookingDetails.name,
            address: hotel.bookingDetails.road,
            city: hotel.bookingDetails.road.split(",")[1]?.trim() || "Unknown",
            postCode: hotel.bookingDetails.postCode,
            fromDay: checkinParts[1],
            fromMonth: monthMap[checkinParts[2]],
            fromYear: checkinParts[3],
            toDay: checkoutParts[1],
            toMonth: monthMap[checkoutParts[2]],
            toYear: checkoutParts[3]
        };
    });

    const summary = tourData.trip.summary;

    return { hotels, summary };
}



bookHotel({
    city: 'London',
    checkinDate: '2025-05-12"',
    checkoutDate: '2025-05-19',
    budgetMin: '250',
    budgetMax: '300',
    adults: '1',
    firstName: 'Aibek',
    lastName: 'Aliev',
    email: 'aibekaliev@gmail.com',
    phoneNumber: '7088039003'
});

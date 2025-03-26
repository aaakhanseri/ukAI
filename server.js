const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3030;

app.use(bodyParser.json());
app.use(express.static('public'));

let userFormData = {}; // Хранение последней версии анкеты

// 🔹 Первый этап: Проверка анкеты
app.post('/process', async (req, res) => {
    try {
        const userMessage = req.body.message;
        console.log("🔵 Получен запрос на обработку анкеты:", userMessage);

        const prompt1 = `
Ваша задача — проанализировать анкету, проверить ее на полноту и правильность, а затем представить пользователю в кратком виде:

1. Проверьте, есть ли ошибки или пропущенные данные.
2. Отформатируйте анкету в кратком виде: 
   - Вопрос: Ответ
   - Если данных нет, добавьте пометку "Требуется ввод".
   - Дата рождения и другие даты должны быть в формате dd.mm.yyyy (если дается другой формат, переделайте в нужный).
   - Если ответ на вопрос некорректен или нелогичен, напишите "Требуется ввод".
   смотри статус трудойстройства может быть работающий студент и что то связаное с этим, только рабочий и студент вместе
   смотри не обрабатывай и не запращивай ввода у окон развилок допустим Текущий адрес: и там он перечсляет переменные то есть не запращивай у самого текущий адрес ввода и тд тп, также с детьми то есть ребенок 1 и тд и тп и так с другими вообще никогда
А также при выводе **не выводи эти заголовки : Личные данные, Семейное положение, Дети, Адрес проживания, Паспортные данные, Трудоустройство, Финансы, Текущий адрес, История поездок, Сопровождающие и зависимые лица, Визовая история, а выводи только **вопросы и ответы на них**.
И если возникает ошибка не пиши в чат сообщение Ошибка: и тд тп финальное сообщение, не выводи последним сообщение ошибки 
"Текущий адрес" не запращивай ввод сюда никогда имено для этого окна и что внутри тогда нужно если пропущено
И обрабатывай каждый из ответов не пропускай ничего
Если адресс проживания меньше 2 лет тогда запрашивай эти поля
 Улица адресса в котром проживали меньше 2 лет: Мынбаева 85
 Город адресса в котром проживали меньше 2 лет: Алматы
 Страна адресса в котром проживали меньше 2 лет: Казахстан
 Почтовый индекс адресса в котром проживали меньше 2 лет: 050000
 Период проживание (дд.мм.гггг-дд.мм.гггг): 3 сентября 2021 – 1 февраля 2025
Если человек пишет даты связанными с путешествиями бери в учет что он может ввести даты с 2015 по 2025.

Смотри обрабатывай окно детей теперь:
    Первое поле ввода 'Сколько у вас детей': число, (в зависимости от числа пользователь введет для каждого из ребенка данные по очереди то есть сначала одного ребенка и все его данные (Имя Фамилия Дата рождения Проживает ли с вами Поедет ли с вами (если да тогда Паспортный номер)), затем другого и его все данные, и так далее)
    Затем ты передашь это ввиде Ребенок1 и все его данные, затем Ребенок2 и все его данные то есть Имя фамилия дата рождения проживает ли с вами поедет ли с вами и паспортный номер и когда вводят последнего ребенка то словарь закрывается на ребенке и списко тоже на нем и тд в зависимости от колличество детей.




Не выводи сообщение "Детали поездок", а просто оставь информацию о поездках.
в самом конце не выводи сообщение ошибки
📋 **Анкета:**
${userMessage}
    `;

        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [
                    { role: "system", content: "Ты помощник для проверки анкет. Форматируй анкету в кратком виде и указывай ошибки." },
                    { role: "user", content: prompt1 }
                ],
                temperature: 0.3,
            },
            {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            }
        );

        userFormData = apiResponse.data.choices[0].message.content;
        console.log("🟢 Анкета после проверки:", userFormData);

        res.json({ reply: userFormData });
    } catch (error) {
        console.error("🚨 Ошибка при обработке анкеты:", error.response ? error.response.data : error.message);
        res.status(500).json({ reply: 'Ошибка обработки запроса.' });
    }
});

// 🔹 Второй этап: Обработка анкеты в JSON
app.post('/finalProcess', async (req, res) => {
    try {
        const today = new Date();
        today.setMonth(today.getMonth() + 2); // Добавляем 2 месяца

        const day = today.getDate();
        const month = today.getMonth() + 1; // Месяцы 0-индексированные, поэтому добавляем 1
        const year = today.getFullYear();

        const formattedDate = `day: ${day}, month: ${month}, year: ${year}`;

        let finalFormData = req.body.updatedForm || userFormData;

        if (!finalFormData) {
            console.error("🚨 Ошибка: нет данных для обработки.");
            return res.status(400).json({ reply: 'Ошибка: нет данных для обработки.' });
        }

        console.log("🔵 Отправка анкеты на финальную обработку:", finalFormData);

        const prompt2 = `
Ты помощник, который преобразует анкету в JSON-формат "ключ: значение".  
🔹 **ВАЖНО:**  
- Выведи **ТОЛЬКО JSON** без дополнительных текстов.  
- Используй **ТОЛЬКО английские ключи**, например: "email", "first_name", "passport_number".  
- **Игнорируй пустые или ненужные данные**.  
- Не пропускай вообще никаких значений и не убирай их используй все то что дано
- Правильно обрабатывай детей (если children_count(сколько у вас детей: число) > 0, создай массив dependants) а также переменную hasDependants_described = true. выводи эту переменную а просто бери в учет для обработки, а если (сколько у вас детей: число) = 0 или ответ нету или нет, тогда будет переменная hasDependants_described = false
- Также обрабатывай абсолютно все ответы которые данны (жена дети и все остальное что дано), если тебе не дана четкая инструкция как их обрабатывать то генерируй новые сам
- А также в самом конце обработай ответы и переведи на английский язык а также все ответы имена фамилия адресса название улиц города и страны переводи на английский язык 
- делай формат вывода под те переменные которые упомяноты и делай их с таким же названием, а переменные которые я не упомнял сам генерируешь название на английском изходя от анкеты
📌 **Формат вывода:**  
\`\`\`json
{
  "email": "example@email.com",
  "telephoneNumber": "+77779990000",
  "givenNameFirst": "Иван",
  "familyNameFirst": "Петров",
  "sex": M - for male and F - for female,
  "selectedMarriedStatus": S - single, M - maried, D - divorced,
  "outOfCountryAddress": "здесь улица",
  "townCity": "город",
  "postalCode": "почтовый индекс",
  "countryRef": "Страна",

  givenName = 'Alaska' (Имя супруг);
  familyName = 'Adams' (Фамилия супруга);
  partnerDateOfBirth = { day: "01", month: "01", year: "2002" } (дата рождения супруга/и);
  partnerCountry = 'Kazakhstan' всегда Казахстан;
  travellingWithYou = true (Поедут с вами в Великобританию если да то true, no = false);
  partnerPassportNumber = номер пасспорат супруга/и;



  "selectedTime": {"number": "3", "unit": "years"} (сколько проижваете в нем), ,
  "statusOfOwnership" = {
    OWNED: "ownershipCategory_own",
    RENTED: "ownershipCategory_rent",
  }  кому принадлежит дом если себе тогда owned = "ownershipCategory_own", если аренда тогда rented ="ownershipCategory_rent",


  если selectedTime меньше 2 лет тогда эти переменные тоже
    "overseasAddress_line1": "astana botan",
    "overseasAddress_townCity": "astana",
    "overseasRegion": "astana",
    "overseasPostCode": "AB1 0AA",
    "startDateAtAddress": {"month": "02", "year": "2019"},
    "endDateAtAddress": {"month": "04", "year": "2020"},
  
  "passportNumber": "123456789" (номер заграничного пасспорта),
  "issuingAuthority": "Astana" (орган выдавший загран пасспорт документ),
  "issueDate": {"day": "01", "month": "01", "year": "2020"} период,
  "expiryDate": {"day": "01", "month": "01", "year": "2030"} период,
  "passportId": "123456789" ID,
  "issuingAuthorityId": "Astana",
  "issueDateId": {"day": "01", "month": "01", "year": "2020"},
  "expiryDateId": {"day": "01", "month": "01", "year": "2030"},
  
  "countryOfBirth": возьми страну с поля место рождения,
  "placeOfBirth":  возьми город с поля место рождения,
  "dateOfBirth": {"day": "15", "month": "05", "year": "1990"},
  "selectedStatuses" = (Статус трудоустройство)
  смотри а также в анкете когда юзер вводит статус трудоустройства он может написсать вместе сразу работаю и студент либо что то в этом духе,
  то есть сразу 2 параметра то что работает и студент смотри как результат он выведит selectedStatuses список из двух значений то есть (selectedStatuses = ["status_employed","status_employed"])
    if EMPLOYED: ["status_employed"],
    if SELF_EMPLOYED: ["status_self-employed"],
    if STUDENT: ["status_student"],
    if RETIRED: ["status_retired"],
    if UNEMPLOYED: ["status_unemployed"]
  
  if selectedStatuses = EMPLOYED{
    "employerName": "Tech Corp", (Название организации)
    "employerAddress": "123 Tech Street" (полный адресс улица и город),
    "employerCity": "London" город,
    "employerState": "London" город,
    "employerPostCode": "SW1A 1AA" возьми почтовый индекс с ответа,
    "employerCountry": "Kazakhstan" страна,
    "employerPhone": {"code": "44", "number": "7123456789"} возьми код как первую цифру номера и номер остальные цифры,
    "workingDate": {"month": "01", "year": "2020"} период начала работы,
    "jobTitle": "Developer" должность,
    "earnValute": "KZT" валюта бери ее в конце в окне дохода, 
    "earnAmount": бери значение с окна "Сколько зарабатываете в месяц?",
    "jobDescription": "Software development" генерируй 2 предложения исходя из должности и придумай что ты делаешь,
  }

  if selectedStatuses = SELF_EMPLOYED{
    "jobTitle": "Developer" бери с поля Чем занимаетесь?,
    "earnValute": "KZT" , 
    "earnAmount": бери значение с окна "Сколько зарабатываете в месяц?",
    "jobDescription": "Software development" генерируй 2 предложения исходя из jobTitle и придумай что ты делаешь,
  }

  "moneyInBankAmount" = бери с поля сколько денег будет на счету (а затем дели на 635) и засовый в ковычки результат как значение

  "payingForYourVisit" = если кто то платит за тебя тогда true, если сам платишь за поездку тогда false, бери ответ с поля кто оплачивает поездку
  

  "whoWillBePaying" = (если payingForYourVisit = true тогда обрабатывай вот так: {
    если кто то кого я знакю тогда вводи это: "whoIsPayingRef_someoneIKnow",
    если моя компания или организации тогда вводи это: "whoIsPayingRef_myEmployerOrCompany",
    если другая компания или организации тогда вводи это:  "whoIsPayingRef_otherEmployerOrCompany",
  }, а если payingForYourVisit = false, тогда ничего не будет)

  if whoWillBePaying = whoIsPayingRef_someoneIKnow{
    payeeName = "имя" бери с поля имя того кто оплачивает;
    address_line1 = "Astana" бери с поля имя Адрес с городом индексом и страной человека кто оплачивает;
    address_townCity = "Astana"  бери с поля имя Адрес с городом индексом и страной человека кто оплачивает бери город;
    address_province = "Astana"  бери с поля имя Адрес с городом индексом и страной человека кто оплачивает бери город;
    address_postalCode = "AB1 0AA"  бери с поля имя Адрес с городом индексом и страной человека кто оплачивает бери почтовый индекс;
    address_countryRef_ui = "Kazakhstan"  бери с поля имя Адрес с городом индексом и страной человека кто оплачивает бери страну с того же поля;
    choosenValue = "GBP";
    choosenAmount = бери с поля суммы оплаты в кто оплачивает поездку(а затем дели на 635) и засовый в ковычки результат как значение;
    descriptionWhyAreTheyHelping = бери ответ с поля причина в секции кто оплачивает, а также логически доплни ее сам на 2 предложения;
  }
  
  if whoWillBePaying = whoIsPayingRef_myEmployerOrCompany{
    choosenValue = "GBP"
    choosenAmount = бери с поля кто оплачивает поездку если компания сумма (а затем дели на 635) и засовый в ковычки результат как значение;
    descriptionWhyAreTheyHelping = бери с поля кто оплачивает поездку если компания почему платят;
  }
  
  
  
  и обязательно генерируй вот эти ключи и значения вне зависимости от других данных
  arrivalDay = бери ${formattedDate}  бери в кавычки;
  arrivalMonth = бери дату из arrivalDay и води сюда месяц а  и бери в кавычки;
  arrivalYear = бери дату из arrivalDay и води сюда год а  и бери в кавычки;
  departureDay = бери дату из arrivalDay и добавь дни (от 12 до 16 и каждый раз ранодомно) которая сегодня и води сюда день и бери в кавычки;;
  departureMonth = бери дату из departureDay и води сюда месяц а  и бери в кавычки;
  departureYear = бери дату из departureDay и води сюда месяц а  и бери в кавычки;
  
  - Если children_count больше 0, создай массив dependants, в котором будет **отдельный словарь для каждого ребенка**. а также переменную hasDependants_described = true
   если (сколько у вас детей: число) = 0 или ответ нету или нет, тогда будет переменная hasDependants_described = false
- Каждый словарь в dependants должен включать:  
  - givenName, familyName, dateOfBirth, relationship (child)
  - livingWithYou, travellingWithYou
  - Если travellingWithYou = true, добавь passportNumber
  
Пример:  

  "dependants": [
    {
      "givenName": "Анна",
      "familyName": "Петрова",
      "dateOfBirth": { "day": "15", "month": "05", "year": "2015" },
      "relationship": "child",
      "livingWithYou": true,
      "travellingWithYou": false
    },
    {
      "givenName": "Алексей",
      "familyName": "Петров",
      "dateOfBirth": { "day": "20", "month": "07", "year": "2018" },
      "relationship": "child",
      "livingWithYou": true,
      "travellingWithYou": true,
      "passportNumber": "A12345678"
    }
  ]




 Теперь пойдут другие страны(Сколько раз были в Австралии, Швейцарии, США, Канаде, Новой Зеландии, Европе за последние 10 лет?) и ты будешь их обрабатывать вот так как список словарей 
  worldTravelCount = будет писать кол-во стран посетивщих из списка travels   у нас идут такие развилки и в зависимости от количества стран где он побывал у нас будет переменная isTraveledCountries которая будет хранить переменую то есть
    он будет брать ответ на вопрос отсюда
    Сколько раз были в Австралии, Швейцарии, США, Канаде, Новой Зеландии, Европе за последние 10 лет? и он водит число смотри если ответ 
    0 раз = 'bandRef_0',
    1 раз = 'bandRef_1',
    2-5 раз = 'bandRef_2'
    и больше 6 раз = 'bandRef_6'
    то есть если я ответил 4 раза тогда будет 
    isTraveledCountries: bandRef_2 и тд и тп и затем пойдет список стран и значения как снизу
    затем он будет писать список и словарей в тех странах где он был допустим он ввел кол-во страны и будет список из словарей на каждую из стран с параметрами
    
    параметры
    reason = {
      TOURISM: 'reasonForVisit_tourism',
      WORK:'reasonForVisit_tourism',
      STUDY:'reasonForVisit_tourism',
      TRANSIT:'reasonForVisit_tourism',
      OTHER:'reasonForVisit_tourism'
          }

      параметры для страны то есть если будет одна из этих стран то ключ country будет иметь следующее значение а если ни одной из страны нет тогда отсается имя страны{
      AUSTRALIA: 'countryRef_australia',
      CANADA: 'countryRef_canada',
      NEWZEALAND: 'countryRef_newzealand',
      USA: 'countryRef_usa'
      }



  travelDetails = [
    { 
        country: "Germany",
        reason: reasonForVisit_tourism,
        arrivalDate: { month: "01", year: "2020" },
        howLong: будет брать разницы между начальным и конечным днем и будет вводить период прибывания в днях ("howLong": { "type": " ", "amount": "" },)
    }];
    
  
  Теперь пойдут другие страны и ты будешь их обрабатывать вот так как список словарей 
  worldTravelCount = будет писать кол-во стран посетивщих из списка travels
  А также страны которые написаны сокращено пиши полностью ОАЭ - Объединеные Арабские Эмираты и тд и тп
  travels = [
    {
        country: "Kyrgyzstan",
        reason: reasonForVisit_tourism,
        startDate: { day: "01", month: "01", year: "2020" },
        endDate: { day: "01", month: "01", year: "2024" }
    }];

    И обрабатывай родителей с поля родители
    motherName = 'Alaska'; имя мамы
    mother_familyName = 'ABu'; фамилия мамы
    mother_DateOfBirth = { day: "01", month: "01", year: "2002" };
    mother_Country = 'Kazakhstan';
    isMotherSameCountry = true; этот параметр всегда true
    mother_BornCountry = 'Kazakhstan';
    fatherName = 'Alaska';
    father_familyName = 'ABu';
    father_DateOfBirth = { day: "01", month: "01", year: "2002" };
    father_Country = 'Kazakhstan';
    isFatherSameCountry = true; этот параметр всегда true
    father_BornCountry = 'Kazakhstan'; 
    moneySpendMonth =  "бери с поля Сколько тратите ежемесячно и дели это число на 627, и выводи просто число" 
  





}
\`\`\`

📋 **Анкета (формат ключ-значение):**  
${JSON.stringify(finalFormData, null, 2)}
    `;

        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [
                    { role: "system", content: "Ты помощник, который преобразует анкету в JSON-формат ключ-значение." },
                    { role: "user", content: prompt2 }
                ],
                temperature: 0.1,
            },
            {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            }
        );

        let gptResponse = apiResponse.data.choices[0].message.content;
        console.log("GPT-ответ (до парсинга):", gptResponse);

        // Удаляем ```json ``` и возможные лишние символы
        gptResponse = gptResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        if (!gptResponse || gptResponse === "{}") {
            console.error("🚨 Ошибка: GPT вернул пустой JSON.");
            return res.status(500).json({ reply: 'Ошибка: получены пустые данные.' });
        }

        let formattedData;
        try {
            formattedData = JSON.parse(gptResponse);
        } catch (e) {
            console.error("🚨 Ошибка парсинга JSON:", e);
            return res.status(500).json({ reply: 'Ошибка обработки JSON.' });
        }

        console.log('🟢 Финальные данные (ключ: значение):', formattedData);


        // 🔹 Отправляем обновленные данные в uk_try_with_post.js
        const updateResponse = await axios.post('http://localhost:4000/updateData', formattedData, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Данные успешно обновлены в uk_try_with_post.js:', updateResponse.data);

        // 🔹 После успешного обновления запускаем Puppeteer
        const scriptResponse = await axios.post('http://localhost:4000/run-script', {}, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Puppeteer-скрипт успешно запущен:', scriptResponse.data);

        res.json({
            reply: formattedData,
            message: 'Данные обновлены и скрипт запущен.',
            response: scriptResponse.data
        });

    } catch (error) {
        console.error("🚨 Ошибка при обработке JSON:", error.response ? error.response.data : error.message);
        res.status(500).json({ reply: 'Ошибка обработки запроса.' });
    }

});

app.post('/finalSubmit', async (req, res) => {
    try {
        console.log("🟡 Запрос на финальную отправку данных получен...");

        // Вызываем /finalProcess, чтобы получить финальные данные
        const finalProcessResponse = await fetch('http://localhost:3000/finalProcess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updatedForm: userFormData })
        });

        const finalData = await finalProcessResponse.json();

        if (!finalData.reply) {
            console.error('Ошибка: финальные данные не получены.');
            return res.status(500).json({ message: 'Ошибка: финальные данные не получены.' });
        }

        console.log('Финальные ключ-значения для отправки:', finalData.reply);

        // нужно заменить на реальный если что
        const response = await fetch('http://localhost:4000/updateData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalData.reply)
        });

        const responseData = await response.json();
        console.log("🎉 Данные успешно отправлены:", responseData);

        res.json({ message: 'Финальные данные успешно отправлены.', response: responseData });

    } catch (error) {
        console.error('🚨 Ошибка при отправке данных:', error);
        res.status(500).json({ message: 'Ошибка при отправке данных.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

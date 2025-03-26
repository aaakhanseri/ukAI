import fetch from 'node-fetch';

const apiKey = 'b031d2fc-bed6-449a-baa7-6cf810dc29c2';
const apiUrl = 'https://humanize.undetectable.ai/submit';

export async function humanizeText(content) {
    const data = {
        content: content,
        readability: 'High School',
        purpose: 'General Writing',
        strength: 'More Human',
        model: 'v11',
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Ошибка при отправке текста: ${response.statusText}`);
        }

        const result = await response.json();
        const documentId = result.id;

        // Проверяем статус обработки текста
        let statusResponse;
        let statusResult;
        do {
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Ждем 5 секунд перед повторной проверкой

            statusResponse = await fetch('https://humanize.undetectable.ai/document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey,
                },
                body: JSON.stringify({ id: documentId }),
            });

            if (!statusResponse.ok) {
                throw new Error(`Ошибка при проверке статуса: ${statusResponse.statusText}`);
            }

            statusResult = await statusResponse.json();
        } while (!statusResult.output);

        return statusResult.output;
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Пример использования функции



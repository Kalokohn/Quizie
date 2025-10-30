// ============================================
// VERCEL SERVERLESS FUNCTION
// Voor veilige OpenAI API calls
// ============================================

export default async function handler(req, res) {
    // Alleen POST requests toestaan
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, numQuestions } = req.body;

        // Validatie
        if (!text || !numQuestions) {
            return res.status(400).json({ error: 'Text en numQuestions zijn verplicht' });
        }

        // API key uit environment variable (VEILIG!)
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key niet geconfigureerd' });
        }

        // Tekst inkorten als het te lang is
        const maxLength = 15000;
        const textToSend = text.length > maxLength ? text.substring(0, maxLength) : text;

        // Prompt voor OpenAI
        const prompt = `Je bent een quiz maker. Genereer ${numQuestions} multiple choice vragen op basis van ALLEEN de volgende tekst. 

BELANGRIJKE REGELS:
- Gebruik ALLEEN informatie uit de tekst hieronder
- Verzin NIETS zelf
- Elk correct antwoord moet letterlijk uit de tekst komen
- Geef 3 foute maar plausibele antwoorden per vraag
- Maak de vragen duidelijk en eenduidig

TEKST:
${textToSend}

Geef het resultaat als JSON array in dit formaat:
[
  {
    "question": "Vraag hier?",
    "answers": ["Antwoord A", "Antwoord B", "Antwoord C", "Antwoord D"],
    "correctIndex": 0
  }
]

Geef ALLEEN de JSON array terug, geen andere tekst.`;

        // OpenAI API call
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Je bent een quiz generator die alleen feitelijke vragen maakt op basis van gegeven tekst.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API call mislukt');
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // JSON uit de response halen
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Geen geldige JSON ontvangen van OpenAI');
        }

        const questions = JSON.parse(jsonMatch[0]);

        // Succes!
        return res.status(200).json({ questions });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Fout bij het genereren van vragen',
            details: error.message 
        });
    }
}

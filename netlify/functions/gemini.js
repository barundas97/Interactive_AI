const axios = require("axios");

exports.handler = async function (event, context) {
  try {
    // Parse incoming request body
    const { prompt, history } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Prompt is missing." }),
      };
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [...(history || []), { role: "user", parts: [{ text: prompt }] }],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Validate API response
    if (!response.data) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No response from Gemini API." }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response.data),
    };
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message || "Internal Server Error",
      }),
    };
  }
};

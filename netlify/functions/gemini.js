const axios = require("axios");

exports.handler = async function (event, context) {
  try {
    // Log incoming request body
    console.log("🔵 Raw event.body:", event.body);

    const body = JSON.parse(event.body || '{}');
    const { prompt, history } = body;

    if (!prompt || typeof prompt !== 'string') {
      console.error("🔴 Missing or invalid prompt.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Prompt is missing or invalid." }),
      };
    }

    const safeHistory = Array.isArray(history) ? history : [];

    const payload = {
      contents: [...safeHistory, { role: "user", parts: [{ text: prompt }] }],
    };

    console.log("🟢 Sending payload to Gemini:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data) {
      console.error("🔴 Gemini returned empty response");
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No response from Gemini API." }),
      };
    }

    console.log("✅ Gemini response:", JSON.stringify(response.data));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response.data),
    };
  } catch (err) {
    console.error("❌ Gemini API Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message || "Internal Server Error",
      }),
    };
  }
};

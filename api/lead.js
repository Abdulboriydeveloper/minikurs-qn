const AMO_DOMAIN = (process.env.AMO_DOMAIN || 'https://akromabdugafforov2440.amocrm.ru').replace(/\/+$/, '');
const AMO_TOKEN = process.env.AMO_ACCESS_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImU1MmI1M2E5MWZhMmJjM2Y3ODdmNzI4YmVlNzUxZGVjZGFiOWQwYTdkM2QxYWY0MzU0YmE4NGUyODc0MzYzZmM3NTQ5Mjk4NmM2YTZlOTEzIn0.eyJhdWQiOiJjODQxNDc0MC05ZmMzLTQzYWYtYTgzYi04NWNjNTQ2OWVjNTMiLCJqdGkiOiJlNTJiNTNhOTFmYTJiYzNmNzg3ZjcyOGJlZTc1MWRlY2RhYjlkMGE3ZDNkMWFmNDM1NGJhODRlMjg3NDM2M2ZjNzU0OTI5ODZjNmE2ZTkxMyIsImlhdCI6MTc3ODY4MDUwMCwibmJmIjoxNzc4NjgwNTAwLCJleHAiOjE4MTAxNjY0MDAsInN1YiI6IjEzMDQwMTM0IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMyNjg5NDE4LCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJwdXNoX25vdGlmaWNhdGlvbnMiLCJmaWxlcyIsImNybSIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiYTI2MzE3ZWQtMWFkNS00MmYwLTliNWMtMjJiOGU0MTExNmYzIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.ZRo6Is4_t6A2EnJt06L-0kFwUCwhEBp445EiL0QEJvPIKpCsLlMtfsA_v76Rb8vRp8hY1AzMY7a-L2YlTkDgBd1hZAyMui0jTe2s_Crs56WV9cQgvRzqAXDdqiR5UOd6OdUnOCq64gd2bEHATU2_5OtVylo5rlEbREIqGzvmgEjGhqkSWLd4ByA5Qo2kfGzqe3wEgqv2hLdr3Gsx-4T0naRwT-9hFehjBNQ9GZb4uiWLwABo2rGH7plfle0svkI1vcOTVxHMr8MoBIhSwcP7lgMfaUXw25yiNdX5E7NifWb9J_o__t04V68gKw7355JxwPOpm8b8ix5-03dbIC0jJA';
const AMO_PIPELINE_ID = 10909382;
const AMO_STATUS_ID = 85806910;
const SHEET_URL = process.env.SHEET_URL || 'https://script.google.com/macros/s/AKfycbxeDIu3I1geF1Rhd_8h90OYobftqqb3e744Tr6Lp03SFNbJc1iN629hu9QZwHaYix_4BA/exec';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function createAmoCrmLead(name, phone) {
  const lead = {
    name: `${name} - Mini Kurs`,
    pipeline_id: AMO_PIPELINE_ID,
    status_id: AMO_STATUS_ID,
    _embedded: {
      contacts: [
        {
          name,
          custom_fields_values: [
            {
              field_code: 'PHONE',
              values: [{ value: phone, enum_code: 'WORK' }],
            },
          ],
        },
      ],
    },
  };

  const response = await fetch(`${AMO_DOMAIN}/api/v4/leads/complex`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AMO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([lead]),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AmoCRM ${response.status}: ${message}`);
  }

  return response.json();
}

async function sendToSheet(name, phone) {
  if (!SHEET_URL) {
    return null;
  }

  const response = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      phone,
      date: new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }),
    }),
  });

  if (!response.ok) {
    console.error('Google Sheet error:', response.status, await response.text());
  }

  return response.ok;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();

    if (name.length < 2 || !/^\+998\d{9}$/.test(phone)) {
      sendJson(res, 400, { ok: false, error: 'Invalid lead data' });
      return;
    }

    const amo = await createAmoCrmLead(name, phone);
    await sendToSheet(name, phone);

    sendJson(res, 200, { ok: true, amo });
  } catch (error) {
    console.error('Lead API error:', error);
    sendJson(res, 502, { ok: false, error: 'Lead submit failed' });
  }
};

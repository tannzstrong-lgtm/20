module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.status(200).json({
    app: 'TannnVideo AI',
    accessConfigured: Boolean(process.env.APP_ACCESS_CODE),
    seedanceConfigured: Boolean(process.env.SEEDANCE_API_KEY && process.env.SEEDANCE_API_BASE_URL && process.env.SEEDANCE_MODEL),
    note: 'Secret values are never returned by this endpoint.'
  });
};

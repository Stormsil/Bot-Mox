const axios = require('axios');
const cheerio = require('cheerio');

const WOW_NAMES_URL = 'https://www.warcrafttavern.com/wow/names/';
const WOW_AJAX_URL = 'https://www.warcrafttavern.com/wp-admin/admin-ajax.php';
const WOW_VIEW_ID = '127153';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchWowNames(seed = '') {
  const bust = seed || `${Date.now()}-${Math.random()}`;
  const url = `${WOW_NAMES_URL}?_=${encodeURIComponent(bust)}`;
  const response = await axios.get(url, {
    timeout: 10000,
    headers: DEFAULT_HEADERS,
  });

  const $ = cheerio.load(response.data);
  return $('.name-output')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

async function fetchWowNamesFromGenerator() {
  const formData = new URLSearchParams({
    action: 'wpv_get_view_query_results',
    id: WOW_VIEW_ID,
    view_number: WOW_VIEW_ID,
    page: '1',
    wpv_view_widget_id: '0',
  });

  const response = await axios.post(WOW_AJAX_URL, formData.toString(), {
    timeout: 10000,
    headers: {
      ...DEFAULT_HEADERS,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  const html = response?.data?.data?.full || '';
  const $ = cheerio.load(html);
  return $('.name-output')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

function normalizeNames(batches) {
  return [...new Set((batches || []).flat().filter(Boolean))];
}

async function getWowNames(options = {}) {
  const countParam = Number(options.count);
  const count = Number.isFinite(countParam) && countParam > 0 ? Math.min(countParam, 50) : 0;
  const batchesParam = Number(options.batches);
  const batches = Number.isFinite(batchesParam) && batchesParam > 0 ? Math.min(Math.floor(batchesParam), 5) : 1;

  let names = normalizeNames(await Promise.all(Array.from({ length: batches }, () => fetchWowNamesFromGenerator())));

  if (!names.length) {
    names = normalizeNames(
      await Promise.all(
        Array.from({ length: batches }, (_, index) => fetchWowNames(`${Date.now()}-${index}-${Math.random()}`))
      )
    );
  }

  if (!names.length) {
    const error = new Error('No names found on source page');
    error.status = 502;
    error.code = 'WOW_NAMES_EMPTY';
    throw error;
  }

  const payload = {
    names: count > 0 ? names.slice(0, count) : names,
    count,
    batches,
    random: names[Math.floor(Math.random() * names.length)],
    source: 'generator-click',
  };

  return payload;
}

module.exports = {
  getWowNames,
};

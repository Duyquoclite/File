const axios = require('axios');

/**
 * Tính khoảng cách và thời gian di chuyển giữa 2 địa điểm bằng cách cào dữ liệu Google Maps (Không cần API Key).
 * @param {string} origin - Điểm xuất phát (VD: 'Đông Hợp, Đông Hưng, Thái Bình')
 * @param {string} destination - Điểm đến (VD: 'Hoàng Mai, Hà Nội')
 * @returns {Promise<{distance: string, duration: string, url: string}>}
 */
async function getRouteInfo(origin, destination) {
  const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`;
  
  try {
    const response = await axios.get(mapsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = response.data;
    
    // Tìm link API preview directions ẩn trong HTML
    const match = html.match(/\/maps\/preview\/directions\?[^"]+/);
    if (!match) {
      throw new Error('Không thể tìm thấy liên kết tuyến đường trên Google Maps.');
    }

    const previewPath = match[0].replace(/&amp;/g, '&');
    const previewUrl = 'https://www.google.com' + previewPath;

    const previewResponse = await axios.get(previewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const jsonText = previewResponse.data.replace(/^\)\]\}'\n/, '');
    const data = JSON.parse(jsonText);

    let distance = null;
    let duration = null;

    // Hàm đệ quy tìm kiếm chuỗi khoảng cách và thời gian trong JSON dạng mảng lồng nhau của Google
    function searchArray(arr) {
      if (!arr) return;
      if (typeof arr === 'string') {
        // Lấy khoảng cách dạng "... km" (lấy kết quả đầu tiên tìm thấy)
        if (/\d+([.,]\d+)?\s*km/i.test(arr) && !distance) {
          distance = arr;
        }
        // Lấy thời gian di chuyển (tránh các chuỗi "cập nhật ... trước" hoặc "báo cáo ... trước")
        if (/(\d+\s*(phút|giờ|p|h))/i.test(arr) && !duration && !arr.includes('trước') && !arr.includes('cập nhật') && !arr.includes('báo cáo')) {
          duration = arr;
        }
        return;
      }
      if (Array.isArray(arr)) {
        arr.forEach(item => searchArray(item));
      } else if (typeof arr === 'object') {
        Object.values(arr).forEach(item => searchArray(item));
      }
    }

    searchArray(data);

    if (!distance || !duration) {
      throw new Error('Không thể trích xuất khoảng cách hoặc thời gian từ dữ liệu Google Maps.');
    }

    return {
      distance,
      duration,
      url: mapsUrl
    };
  } catch (error) {
    throw new Error(`Lỗi khi tính tuyến đường: ${error.message}`);
  }
}

// --- CHẠY THỬ NGHIỆM ---
async function test() {
  const start = 'Đông Hợp, Đông Hưng, Thái Bình';
  const end = 'Hoàng Mai, Hà Nội';
  
  console.log(`Đang tính khoảng cách từ [${start}] đến [${end}]...`);
  
  try {
    const result = await getRouteInfo(start, end);
    console.log('\n✅ THÀNH CÔNG:');
    console.log(`- Khoảng cách: ${result.distance}`);
    console.log(`- Thời gian di chuyển: ${result.duration}`);
    console.log(`- Link Google Maps: ${result.url}`);
  } catch (err) {
    console.error('\n❌ THẤT BẠI:', err.message);
  }
}

test();

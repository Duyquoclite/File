const https = require('https');

const API_KEY = 'AIzaSyDURHwCJM9DkEKAoxKvHhyhIZFYZUof7xs'; 
const origin = 'Đông Hợp, Đông Hưng, Thái Bình';
const destination = 'Hoàng Mai, Hà Nội';

const postData = JSON.stringify({
  origin: {
    address: origin
  },
  destination: {
    address: destination
  },
  travelMode: 'DRIVE',
  routingPreference: 'TRAFFIC_UNAWARE',
  computeAlternativeRoutes: false,
  languageCode: 'vi-VN'
});

const options = {
  hostname: 'routes.googleapis.com',
  path: '/directions/v2:computeRoutes',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.startLocation,routes.legs.endLocation'
  }
};

console.log('Đang gửi yêu cầu tới Google Routes API (v2)...');

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      if (!body) {
        console.log('Response body is empty.');
        return;
      }
      const data = JSON.parse(body);
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distanceMeters / 1000).toFixed(1);
        
        let durationText = route.duration;
        if (durationText && durationText.endsWith('s')) {
          const seconds = parseInt(durationText.slice(0, -1), 10);
          const hrs = Math.floor(seconds / 3600);
          const mins = Math.floor((seconds % 3600) / 60);
          durationText = `${hrs > 0 ? hrs + ' giờ ' : ''}${mins} phút`;
        }

        console.log('\n--- KẾT QUẢ GOOGLE ROUTES API (v2) ---');
        console.log(`Điểm đi: ${origin}`);
        console.log(`Điểm đến: ${destination}`);
        console.log(`Khoảng cách: \x1b[32m${distanceKm} km\x1b[0m`);
        console.log(`Thời gian di chuyển: \x1b[36m${durationText}\x1b[0m`);
      } else {
        console.log('\n❌ Lỗi hoặc không tìm thấy tuyến đường:');
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error('Không thể parse kết quả:', body);
    }
  });
});

req.on('error', (err) => {
  console.error('Lỗi kết nối:', err.message);
});

req.write(postData);
req.end();

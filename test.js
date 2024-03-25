const axios = require("axios");
const cheerio = require("cheerio");

axios({
  url: "https://www.cleancss.com/javascript-obfuscate/index.php",
  method: "POST",
  data: {
    ascii_encoding: "62", //numeric: 10, normal: 62, high ASCII: 95
    fast_decode: "on",
    special_char: "on",
    src: 'console.log(3)',
  },
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "sec-ch-ua": "\"Google Chrome\";v=\"123\", \"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"123\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "upgrade-insecure-requests": "1",
    "Referer": "https://www.cleancss.com/javascript-obfuscate/index.php",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
})
  .then((response) => {
    const html = response.data;
    const $ = cheerio.load(html);
    const textareaValue = $("#packed").text();
    console.log(textareaValue);
  })
  .catch((error) => {
    console.error(error);
  });

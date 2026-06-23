/**
 * FINGERPRINT SERVICE - MAXIMUM VERSION 2026
 * Rất nhiều dữ liệu, đa dạng cao, realistic nhất có thể
 */

function generateRealisticChromeVersion(major) {
    const build = Math.floor(Math.random() * 1000) + 6000;
    const patch = Math.floor(Math.random() * 200);
    return `${major}.0.${build}.${patch}`;
}

function generateUserAgents() {
    const list = [];
    // Windows Chrome
    for (let i = 0; i < 40; i++) {
        const major = 134 - i;
        const ver = generateRealisticChromeVersion(major);
        list.push(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`);
    }
    // Windows Edge
    for (let i = 0; i < 20; i++) {
        const major = 134 - i;
        const ver = generateRealisticChromeVersion(major);
        list.push(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36 Edg/${ver}`);
    }
    // macOS Chrome
    for (let i = 0; i < 25; i++) {
        const major = 134 - i;
        const ver = generateRealisticChromeVersion(major);
        const osVer = `10_15_${Math.floor(Math.random() * 8)}`;
        list.push(`Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVer}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`);
    }
    // Linux Chrome
    for (let i = 0; i < 15; i++) {
        const major = 134 - i;
        const ver = generateRealisticChromeVersion(major);
        list.push(`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`);
        list.push(`Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`);
    }
    return list;
}

const USER_AGENTS = generateUserAgents();

const TIMEZONES = Intl.supportedValuesOf('timeZone');

const BASE_LANGUAGES = [
    { lang: 'en', regions: ['US', 'GB', 'CA', 'AU', 'NZ', 'IN', 'ZA', 'IE'] },
    { lang: 'vi', regions: ['VN'] },
    { lang: 'zh', regions: ['CN', 'TW', 'HK'] },
    { lang: 'es', regions: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE'] },
    { lang: 'fr', regions: ['FR', 'CA', 'BE', 'CH'] },
    { lang: 'de', regions: ['DE', 'AT', 'CH'] },
    { lang: 'pt', regions: ['PT', 'BR'] },
    { lang: 'ja', regions: ['JP'] },
    { lang: 'ko', regions: ['KR'] },
    { lang: 'ru', regions: ['RU', 'BY', 'KZ', 'UA'] },
    { lang: 'ar', regions: ['SA', 'EG', 'AE', 'QA', 'DZ', 'MA'] },
    { lang: 'tr', regions: ['TR'] },
    { lang: 'it', regions: ['IT', 'CH'] },
    { lang: 'th', regions: ['TH'] },
    { lang: 'id', regions: ['ID'] },
    { lang: 'ms', regions: ['MY'] },
    { lang: 'fil', regions: ['PH'] },
    { lang: 'nl', regions: ['NL', 'BE'] },
    { lang: 'pl', regions: ['PL'] },
    { lang: 'uk', regions: ['UA'] },
    { lang: 'ro', regions: ['RO'] },
    { lang: 'hu', regions: ['HU'] },
    { lang: 'el', regions: ['GR'] },
    { lang: 'cs', regions: ['CZ'] },
    { lang: 'sv', regions: ['SE'] },
    { lang: 'he', regions: ['IL'] },
    { lang: 'da', regions: ['DK'] },
    { lang: 'fi', regions: ['FI'] },
    { lang: 'nb', regions: ['NO'] },
    { lang: 'sk', regions: ['SK'] },
    { lang: 'hr', regions: ['HR'] },
    { lang: 'bg', regions: ['BG'] },
    { lang: 'lt', regions: ['LT'] },
    { lang: 'et', regions: ['EE'] },
    { lang: 'lv', regions: ['LV'] },
    { lang: 'sl', regions: ['SI'] },
    { lang: 'ca', regions: ['ES'] },
    { lang: 'sr', regions: ['RS'] },
    { lang: 'hi', regions: ['IN'] },
    { lang: 'bn', regions: ['BD', 'IN'] },
    { lang: 'fa', regions: ['IR'] },
    { lang: 'ur', regions: ['PK'] },
    { lang: 'sw', regions: ['KE', 'TZ'] },
    { lang: 'af', regions: ['ZA'] },
    { lang: 'am', regions: ['ET'] },
    { lang: 'zu', regions: ['ZA'] },
    { lang: 'ha', regions: ['NG'] },
];

function generateLanguagesList() {
    const list = [];
    for (const item of BASE_LANGUAGES) {
        const { lang, regions } = item;
        for (const region of regions) {
            const locale = `${lang}-${region}`;
            if (lang !== 'en') {
                list.push([locale, lang, 'en-US', 'en']);
                list.push([locale, lang]);
            } else {
                list.push([locale, 'en']);
            }
            list.push([locale]);
        }
    }
    list.push(['en-US', 'en']);
    list.push(['en-GB', 'en']);
    return list;
}

const LANGUAGES = generateLanguagesList();

const SCREEN_RESOLUTIONS = [
    { w: 1920, h: 1080 }, { w: 1366, h: 768 }, { w: 1536, h: 864 }, { w: 1440, h: 900 },
    { w: 1280, h: 720 }, { w: 2560, h: 1440 }, { w: 1600, h: 900 }, { w: 1680, h: 1050 },
    { w: 3440, h: 1440 }, { w: 3840, h: 2160 }, { w: 1920, h: 1200 }, { w: 1280, h: 800 },
    { w: 2560, h: 1080 }, { w: 1366, h: 1024 }, { w: 1600, h: 1200 }, { w: 2048, h: 1152 },
];

const FONT_FAMILIES = [
    'Arial', 'Arial Black', 'Baskerville', 'Book Antiqua', 'Calibri',
    'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Courier New',
    'Georgia', 'Helvetica', 'Impact', 'Lucida Grande', 'Lucida Sans Unicode',
    'Microsoft Sans Serif', 'Palatino', 'Segoe UI', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana', 'Courier', 'Monaco', 'Menlo', 'Segoe UI Emoji',
    'Segoe UI Symbol', 'Roboto', 'Noto Sans', 'Arial Narrow'
];

const GPU_CONFIGS = [
    // Intel
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) UHD Graphics 770',
        webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770, OpenGL 4.5)'
    },
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) UHD Graphics 750',
        webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 750, OpenGL 4.5)'
    },
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) UHD Graphics 730',
        webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 730, OpenGL 4.5)'
    },
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) UHD Graphics 630',
        webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)'
    },
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) UHD Graphics 620',
        webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620, OpenGL 4.5)'
    },
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) Iris(R) Xe Graphics',
        webglRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, OpenGL 4.5)'
    },
    {
        vendor: 'Intel Inc.',
        webglVendor: 'Google Inc. (Intel)',
        gpuName: 'Intel(R) Iris(R) Plus Graphics',
        webglRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Plus Graphics, OpenGL 4.5)'
    },

    // NVIDIA
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 4090',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 4080',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 4070 Ti',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 4060 Ti',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 4060',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 3080',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 3070',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 3060 Ti',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 3060',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 3050',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce RTX 2060',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce GTX 1660 Super',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Super Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'NVIDIA Corporation',
        webglVendor: 'Google Inc. (NVIDIA)',
        gpuName: 'NVIDIA GeForce GTX 1650',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },

    // AMD
    {
        vendor: 'AMD Corporation',
        webglVendor: 'Google Inc. (AMD)',
        gpuName: 'AMD Radeon RX 7900 XTX',
        webglRenderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'AMD Corporation',
        webglVendor: 'Google Inc. (AMD)',
        gpuName: 'AMD Radeon RX 7800 XT',
        webglRenderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'AMD Corporation',
        webglVendor: 'Google Inc. (AMD)',
        gpuName: 'AMD Radeon RX 6700 XT',
        webglRenderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'AMD Corporation',
        webglVendor: 'Google Inc. (AMD)',
        gpuName: 'AMD Radeon RX 6600 XT',
        webglRenderer: 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
        vendor: 'AMD Corporation',
        webglVendor: 'Google Inc. (AMD)',
        gpuName: 'AMD Radeon RX 580',
        webglRenderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },

    // Apple
    {
        vendor: 'Apple Inc.',
        webglVendor: 'Google Inc. (Apple)',
        gpuName: 'Apple M3',
        webglRenderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)'
    },
    {
        vendor: 'Apple Inc.',
        webglVendor: 'Google Inc. (Apple)',
        gpuName: 'Apple M2',
        webglRenderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)'
    },
    {
        vendor: 'Apple Inc.',
        webglVendor: 'Google Inc. (Apple)',
        gpuName: 'Apple M1',
        webglRenderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
    }
];

const GPU_ARCHITECTURES = ['x86_64', 'arm64', 'x86', 'unknown'];

const DEVICE_MEMORY = [4, 6, 8, 8, 12, 16, 16, 32];
const MAX_TOUCH_POINTS = [0, 1, 5, 10];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickFonts() {
    return shuffle(FONT_FAMILIES).slice(0, 18);
}

function generateFingerprint() {
    const ua = pick(USER_AGENTS);
    const screen = pick(SCREEN_RESOLUTIONS);
    const languages = pick(LANGUAGES);
    const isMac = ua.includes('Mac');

    let gpuConfig;
    if (isMac) {
        const appleGpus = GPU_CONFIGS.filter(g => g.vendor === 'Apple Inc.');
        gpuConfig = pick(appleGpus.length ? appleGpus : GPU_CONFIGS);
    } else {
        const pcGpus = GPU_CONFIGS.filter(g => g.vendor !== 'Apple Inc.');
        gpuConfig = pick(pcGpus.length ? pcGpus : GPU_CONFIGS);
    }

    const deviceMemory = pick(DEVICE_MEMORY);
    let hardwareConcurrency;
    if (deviceMemory <= 4) {
        hardwareConcurrency = pick([2, 4]);
    } else if (deviceMemory <= 8) {
        hardwareConcurrency = pick([4, 6, 8]);
    } else if (deviceMemory <= 16) {
        hardwareConcurrency = pick([8, 12, 16]);
    } else {
        hardwareConcurrency = pick([12, 16, 20, 24, 32]);
    }

    return {
        userAgent: ua,
        platform: isMac ? 'MacIntel' :
            ua.includes('Linux') ? 'Linux x86_64' : 'Win32',
        vendor: 'Google Inc.',
        languages: languages,
        timezone: pick(TIMEZONES),

        screen: {
            width: screen.w,
            height: screen.h,
            availWidth: screen.w,
            availHeight: screen.h - randomInt(25, 95),
            colorDepth: 24,
            pixelDepth: 24,
        },

        hardwareConcurrency,
        deviceMemory,
        maxTouchPoints: pick(MAX_TOUCH_POINTS),
        doNotTrack: pick(['1', null]),
        fonts: pickFonts(),
        historyLength: randomInt(2, 6),
        gpu: {
            name: gpuConfig.gpuName,
            architecture: pick(GPU_ARCHITECTURES),
            vendor: gpuConfig.vendor,
        },

        webgl: {
            vendor: gpuConfig.webglVendor,
            renderer: gpuConfig.webglRenderer,
        },

        canvas: {
            noise: Math.random() * 0.12 + 0.02,
            seed: randomInt(1000000, 99999999),
        },

        audio: {
            noise: Math.random() * 0.0005 + 0.0001,
            seed: randomInt(1000000, 99999999),
        },

        webrtc: {
            mode: 'disable_non_proxied_udp'
        }
    };
}

// Build script injection (giữ nguyên hàm cũ của bạn nhưng tối ưu)
function buildFingerprintScript(fp) {
    const userAgentData = getUserAgentData(fp.userAgent);
    const pluginList = getPluginList();
    const mimeTypeList = getMimeTypeList();
    const mediaDevices = getMediaDeviceList(fp);
    const timezoneOffset = getTimezoneOffset(fp.timezone);

    return `
        ;(() => {
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, contextAttributes) {
                if (type === '2d') {
                    if (!contextAttributes) contextAttributes = {};
                    contextAttributes.willReadFrequently = true;
                }
                return originalGetContext.call(this, type, contextAttributes);
            };

            if (window.OffscreenCanvas) {
                const originalOffscreenGetContext = OffscreenCanvas.prototype.getContext;
                OffscreenCanvas.prototype.getContext = function(type, contextAttributes) {
                    if (type === '2d') {
                        if (!contextAttributes) contextAttributes = {};
                        contextAttributes.willReadFrequently = true;
                    }
                    return originalOffscreenGetContext.call(this, type, contextAttributes);
                };
            }

            const fakeNavigator = {
                userAgent: ${JSON.stringify(fp.userAgent)},
                platform: ${JSON.stringify(fp.platform)},
                vendor: ${JSON.stringify(fp.vendor)},
                language: ${JSON.stringify(fp.languages[0])},
                languages: ${JSON.stringify(fp.languages)},
                hardwareConcurrency: ${fp.hardwareConcurrency},
                deviceMemory: ${fp.deviceMemory},
                maxTouchPoints: ${fp.maxTouchPoints},
                doNotTrack: ${fp.doNotTrack ? JSON.stringify(fp.doNotTrack) : 'null'},
                webdriver: false,
                product: 'Gecko',
                productSub: '20030107',
                vendorSub: '',
                buildID: '20250101',
                cookieEnabled: true,
            };

            const fakeUserAgentData = {
                brands: ${JSON.stringify(userAgentData.brands)},
                mobile: ${userAgentData.mobile},
                platform: ${JSON.stringify(fp.platform)},
                getHighEntropyValues: (hints) => {
                    const result = {};
                    if (hints.includes('architecture')) result.architecture = 'x86';
                    if (hints.includes('model')) result.model = '';
                    if (hints.includes('platform')) result.platform = ${JSON.stringify(fp.platform)};
                    if (hints.includes('platformVersion')) result.platformVersion = '10.0.0';
                    if (hints.includes('uaFullVersion')) result.uaFullVersion = ${JSON.stringify(getUAFullVersion(fp.userAgent))};
                    if (hints.includes('fullVersionList')) result.fullVersionList = ${JSON.stringify(userAgentData.brands)};
                    return Promise.resolve(result);
                }
            };

            if (window.NavigatorUAData) {
                try {
                    window.NavigatorUAData.prototype.getHighEntropyValues = function(hints) {
                        const result = {};
                        if (hints.includes('architecture')) result.architecture = 'x86';
                        if (hints.includes('model')) result.model = '';
                        if (hints.includes('platform')) result.platform = ${JSON.stringify(fp.platform)};
                        if (hints.includes('platformVersion')) result.platformVersion = '10.0.0';
                        if (hints.includes('uaFullVersion')) result.uaFullVersion = ${JSON.stringify(getUAFullVersion(fp.userAgent))};
                        if (hints.includes('fullVersionList')) result.fullVersionList = ${JSON.stringify(userAgentData.brands)};
                        return Promise.resolve(result);
                    };
                } catch (e) {}
            }

            const fakeConnection = {
                effectiveType: '4g',
                downlink: 10,
                rtt: 50,
                saveData: false,
                type: 'wifi',
                onchange: null
            };

            const fakeFonts = ${JSON.stringify(fp.fonts)};
            const fakeGPUInfo = ${JSON.stringify(fp.gpu)};
            const fakePlugins = ${JSON.stringify(pluginList)};
            const fakeMimeTypes = ${JSON.stringify(mimeTypeList)};
            const fakeMediaDevices = ${JSON.stringify(mediaDevices)};
            const fakeHistoryLength = ${fp.historyLength};

            function makeList(items, itemType) {
                const list = {
                    length: items.length,
                    item: function(i) { return this[i] || null; },
                    namedItem: function(name) { return this[name] || null; },
                    refresh: function() {}
                };
                items.forEach((item, idx) => {
                    list[idx] = item;
                    list[itemType === 'plugin' ? item.name : item.type] = item;
                });
                return list;
            }

            function buildFontSet() {
                const fontSet = { length: fakeFonts.length };
                fontSet.check = function(fontSpec) {
                    return fakeFonts.some(font => fontSpec.includes(font));
                };
                fontSet.has = function(fontFace) {
                    const name = typeof fontFace === 'string' ? fontFace : fontFace?.family;
                    return fakeFonts.some(font => name && (font === name || name.includes(font)));
                };
                fontSet.forEach = function(callback) {
                    fakeFonts.forEach((font, index) => callback({ family: font }, index, fontSet));
                };
                fontSet.values = function*() {
                    for (const font of fakeFonts) yield font;
                };
                fontSet.entries = function*() {
                    for (const font of fakeFonts) yield [font, font];
                };
                fontSet.keys = function*() {
                    for (const font of fakeFonts) yield font;
                };
                return fontSet;
            }

            function buildPluginArray() {
                const mimeArray = makeList(fakeMimeTypes, 'mime');
                const pluginArray = makeList([], 'plugin');

                fakePlugins.forEach((pluginDef, idx) => {
                    const mimeItems = pluginDef.types.map(type => mimeArray[type]).filter(Boolean);
                    const pluginObj = {
                        name: pluginDef.name,
                        filename: pluginDef.filename,
                        description: pluginDef.description,
                        length: mimeItems.length,
                        item: function(i) { return this[i] || null; },
                        namedItem: function(name) { return this[name] || null; }
                    };

                    mimeItems.forEach(mime => {
                        if (mime) {
                            mime.enabledPlugin = pluginObj;
                        }
                    });

                    pluginArray[idx] = pluginObj;
                    pluginArray[pluginObj.name] = pluginObj;
                });
                pluginArray.length = fakePlugins.length;
                return { pluginArray, mimeArray };
            }

            const { pluginArray, mimeArray } = buildPluginArray();

            function defineProperty(object, key, value) {
                try {
                    Object.defineProperty(object, key, { get: () => value, configurable: true, enumerable: true });
                } catch (err) {
                    // ignore readonly properties
                }
            }

            function defineMethod(object, key, fn) {
                try {
                    Object.defineProperty(object, key, { value: fn, configurable: true, enumerable: false, writable: true });
                } catch (err) {
                    // ignore
                }
            }

            defineProperty(navigator, 'userAgent', fakeNavigator.userAgent);
            defineProperty(navigator, 'platform', fakeNavigator.platform);
            defineProperty(navigator, 'vendor', fakeNavigator.vendor);
            defineProperty(navigator, 'language', fakeNavigator.language);
            defineProperty(navigator, 'languages', fakeNavigator.languages);
            defineProperty(navigator, 'hardwareConcurrency', fakeNavigator.hardwareConcurrency);
            defineProperty(navigator, 'deviceMemory', fakeNavigator.deviceMemory);
            defineProperty(navigator, 'maxTouchPoints', fakeNavigator.maxTouchPoints);
            defineProperty(navigator, 'doNotTrack', fakeNavigator.doNotTrack);
            defineProperty(navigator, 'webdriver', fakeNavigator.webdriver);
            defineProperty(navigator, 'product', fakeNavigator.product);
            defineProperty(navigator, 'productSub', fakeNavigator.productSub);
            defineProperty(navigator, 'vendorSub', fakeNavigator.vendorSub);
            defineProperty(navigator, 'buildID', fakeNavigator.buildID);
            defineProperty(navigator, 'cookieEnabled', fakeNavigator.cookieEnabled);
            defineProperty(navigator, 'userAgentData', fakeUserAgentData);
            defineProperty(navigator, 'connection', fakeConnection);
            defineProperty(navigator, 'plugins', pluginArray);
            defineProperty(navigator, 'mimeTypes', mimeArray);
            defineProperty(navigator, 'gpu', {
                requestAdapter: () => Promise.resolve({
                    name: fakeGPUInfo.name,
                    vendor: fakeGPUInfo.vendor,
                    architecture: fakeGPUInfo.architecture,
                    features: [],
                    limits: { maxTextureSize: 16384 }
                })
            });

            if (window.document && window.document.fonts) {
                const fakeFontSet = buildFontSet();
                defineMethod(window.document.fonts, 'check', fakeFontSet.check);
                defineMethod(window.document.fonts, 'has', fakeFontSet.has);
                defineMethod(window.document.fonts, 'forEach', fakeFontSet.forEach);
            } else if (window.document) {
                defineProperty(window.document, 'fonts', buildFontSet());
            }

            defineProperty(window, 'chrome', { runtime: {}, loadTimes: () => ({}) });

            if (window.screen) {
                defineProperty(screen, 'width', ${fp.screen.width});
                defineProperty(screen, 'height', ${fp.screen.height});
                defineProperty(screen, 'availWidth', ${fp.screen.availWidth});
                defineProperty(screen, 'availHeight', ${fp.screen.availHeight});
                defineProperty(screen, 'colorDepth', ${fp.screen.colorDepth || 24});
                defineProperty(screen, 'pixelDepth', ${fp.screen.pixelDepth || 24});
            }

            defineProperty(window, 'outerWidth', ${fp.screen.width});
            defineProperty(window, 'outerHeight', ${fp.screen.height});

            if (window.history) {
                const originalPushState = window.history.pushState.bind(window.history);
                const originalReplaceState = window.history.replaceState.bind(window.history);
                defineProperty(window.history, 'length', fakeHistoryLength);
                defineMethod(window.history, 'pushState', function(state, title, url) {
                    if (typeof state === 'object' && state !== null) {
                        state._fp = true;
                    }
                    return originalPushState(state, title, url);
                });
                defineMethod(window.history, 'replaceState', function(state, title, url) {
                    if (typeof state === 'object' && state !== null) {
                        state._fp = true;
                    }
                    return originalReplaceState(state, title, url);
                });
            }

            if (window.performance && !window.performance.memory) {
                defineProperty(window.performance, 'memory', {
                    jsHeapSizeLimit: 2147483648,
                    totalJSHeapSize: 33800000,
                    usedJSHeapSize: 17000000
                });
            }

            const origGetParam = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(p) {
                if (p === 37445) return ${JSON.stringify(fp.webgl.vendor)};
                if (p === 37446) return ${JSON.stringify(fp.webgl.renderer)};
                return origGetParam.call(this, p);
            };

            const canvasSeed = ${fp.canvas.seed};
            const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
            const _toBlob = HTMLCanvasElement.prototype.toBlob;

            HTMLCanvasElement.prototype.toDataURL = function() {
                const ctx = this.getContext('2d');
                if (ctx) {
                    try {
                        const data = ctx.getImageData(0, 0, this.width, this.height);
                        for (let i = 0; i < data.data.length; i += 4) {
                            data.data[i] += (Math.sin(canvasSeed + i) * ${fp.canvas.noise * 10}) | 0;
                        }
                        ctx.putImageData(data, 0, 0);
                    } catch (e) {
                        // ignore security issues on cross-origin canvases
                    }
                }
                return _toDataURL.apply(this, arguments);
            };

            if (_toBlob) {
                HTMLCanvasElement.prototype.toBlob = function() {
                    const ctx = this.getContext('2d');
                    if (ctx) {
                        try {
                            const data = ctx.getImageData(0, 0, this.width, this.height);
                            for (let i = 0; i < data.data.length; i += 4) {
                                data.data[i] += (Math.sin(canvasSeed + i) * ${fp.canvas.noise * 10}) | 0;
                            }
                            ctx.putImageData(data, 0, 0);
                        } catch (e) {
                            // ignore
                        }
                    }
                    return _toBlob.apply(this, arguments);
                };
            }

            if (navigator.permissions && navigator.permissions.query) {
                const originalQuery = navigator.permissions.query.bind(navigator.permissions);
                navigator.permissions.query = function(desc) {
                    if (desc && desc.name) {
                        if (desc.name === 'geolocation') {
                            return Promise.resolve({ state: 'granted', onchange: null, name: desc.name });
                        }
                        const allowed = ['notifications', 'push', 'midi', 'camera', 'microphone'];
                        if (allowed.includes(desc.name)) {
                            return Promise.resolve({ state: 'prompt', onchange: null, name: desc.name });
                        }
                    }
                    return originalQuery(desc);
                };
            }

            if (navigator.mediaDevices) {
                if (navigator.mediaDevices.enumerateDevices) {
                    navigator.mediaDevices.enumerateDevices = function() {
                        return Promise.resolve(fakeMediaDevices.map(device => ({ ...device })));
                    };
                }
                if (navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia = function() {
                        return Promise.reject(new Error('Permission denied'));
                    };
                }
            }

            if (window.RTCPeerConnection) {
                const originalCreateOffer = window.RTCPeerConnection.prototype.createOffer;
                window.RTCPeerConnection.prototype.createOffer = function() {
                    return originalCreateOffer.apply(this, arguments).then(offer => {
                        if (offer && offer.sdp) {
                            offer.sdp = offer.sdp.replace(/a=candidate:[^\r\n]+\r?\n/g, '');
                        }
                        return offer;
                    });
                };

                const originalSetLocalDescription = window.RTCPeerConnection.prototype.setLocalDescription;
                window.RTCPeerConnection.prototype.setLocalDescription = function() {
                    if (arguments[0] && arguments[0].sdp) {
                        arguments[0].sdp = arguments[0].sdp.replace(/a=candidate:[^\r\n]+\r?\n/g, '');
                    }
                    return originalSetLocalDescription.apply(this, arguments);
                };
            }

            const originalDateGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            if (timezoneOffset !== null) {
                Date.prototype.getTimezoneOffset = function() {
                    return timezoneOffset;
                };
            }

            if (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat.prototype) {
                const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
                Intl.DateTimeFormat.prototype.resolvedOptions = function() {
                    const result = originalResolvedOptions.apply(this, arguments);
                    result.timeZone = ${JSON.stringify(fp.timezone)};
                    return result;
                };
            }

            // Audio Fingerprint Spoofing
            const audioSeed = ${fp.audio.seed};
            const audioNoise = ${fp.audio.noise};
            try {
                const addAudioNoise = (buffer) => {
                    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                        const data = buffer.getChannelData(channel);
                        for (let i = 0; i < data.length; i++) {
                            data[i] += Math.sin(audioSeed + i) * audioNoise;
                        }
                    }
                };

                const originalCreateBufferSource = AudioContext.prototype.createBufferSource || webkitAudioContext.prototype.createBufferSource;
                if (originalCreateBufferSource) {
                    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
                    AudioBuffer.prototype.getChannelData = function(channel) {
                        const data = originalGetChannelData.apply(this, arguments);
                        for (let i = 0; i < data.length; i++) {
                            data[i] += Math.sin(audioSeed + i) * audioNoise;
                        }
                        return data;
                    };
                }
            } catch (e) {}

            console.log('%c✅ Fingerprint spoofed successfully', 'color: lime; font-size: 12px');
        })();
    `;
}

function getUAFullVersion(userAgent) {
    const match = userAgent.match(/(?:Chrome|Chromium|Edg)\/([0-9]+(?:\.[0-9]+)*)/);
    return match ? match[1] : '100.0.0.0';
}

function getTimezoneOffset(timezone) {
    if (typeof timezone !== 'string') return null;
    try {
        const date = new Date();
        const dateString = date.toLocaleString('en-US', { timeZone: timezone });
        const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' });
        const dateLoc = new Date(dateString);
        const dateUtc = new Date(utcString);
        return Math.round((dateUtc - dateLoc) / (1000 * 60));
    } catch (e) {
        return null;
    }
}

function getUserAgentData(userAgent) {
    const isEdge = / Edg\//.test(userAgent);
    const version = getUAFullVersion(userAgent).split('.')[0] || '100';
    const brands = isEdge
        ? [
            { brand: 'Chromium', version },
            { brand: 'Google Chrome', version },
            { brand: 'Microsoft Edge', version }
        ]
        : [
            { brand: 'Chromium', version },
            { brand: 'Google Chrome', version }
        ];
    return {
        brands,
        mobile: /Mobile|Android/.test(userAgent)
    };
}

function getPluginList() {
    return [
        {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format',
            types: ['application/pdf', 'application/x-google-chrome-pdf']
        },
        {
            name: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            description: 'Portable Document Format',
            types: ['application/pdf']
        },
        {
            name: 'Native Client',
            filename: 'internal-nacl-plugin',
            description: 'Native Client',
            types: ['application/x-nacl', 'application/x-pnacl']
        }
    ];
}

function getMimeTypeList() {
    return [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Chrome PDF' },
        { type: 'application/x-nacl', suffixes: '', description: 'Native Client' },
        { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client' }
    ];
}

function getMediaDeviceList(fp) {
    const devices = [
        { kind: 'audioinput', deviceId: 'default', label: 'Default Microphone', groupId: 'default' },
        { kind: 'audiooutput', deviceId: 'default', label: 'Default Speakers', groupId: 'default' },
        { kind: 'videoinput', deviceId: 'default', label: 'Integrated Camera', groupId: 'default' }
    ];

    if (fp.maxTouchPoints > 0) {
        devices.push({ kind: 'videoinput', deviceId: 'touchcam', label: 'Front Camera', groupId: 'default' });
    }

    return devices;
}

module.exports = { generateFingerprint, buildFingerprintScript };
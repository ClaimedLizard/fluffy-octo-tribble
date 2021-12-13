const { JSDOM } = require('jsdom');
const jsdom = require('jsdom');
const https = require('https');
const fs = require('fs');
let donda;

const rl = new jsdom.ResourceLoader({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36' });

JSDOM.fromURL('https://youtube.com/playlist?list=PL-Fchr9o2GrNL5D_-sWz0FtQQ9mrYvVEl', { pretendToBeVisual: true, resources: rl }).then((dom) => {
    donda = dom;
    console.log(donda.window.document.querySelector('meta[property="og:title"]').content);
});
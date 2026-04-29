const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('..\\blingy bags_GMV Max_Last 7 days4.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(err => console.error(err));

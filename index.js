const ascii = require('./ascii.js')

function jpii () {
  console.log(ascii)
  return ascii
}

jpii.ascii = ascii
module.exports = jpii

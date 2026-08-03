import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ascii = require('./ascii.js')

function jpii () {
  console.log(ascii)
  return ascii
}

jpii.ascii = ascii

export { ascii, jpii }
export default jpii

const axios = require('axios')
const { levenshteinDistance } = require('../utils/index')
const Logger = require('../Logger')
const pThrottle = require('p-throttle')

class Audnexus {
  static _instance = null

  constructor() {
    // ensures Audnexus class is singleton 
    if (Audnexus._instance) {
      return Audnexus._instance
    }

    this.baseUrl = 'https://api.audnex.us'

    // Rate limit is 100 requests per minute.
    // @see https://github.com/laxamentumtech/audnexus#-deployment-
    this.limiter = pThrottle({
      // Setting the limit to 1 allows for a short pause between requests that is almost imperceptible to 
      // the end user. A larger limit will grab blocks faster and then wait for the alloted time(interval) before
      // fetching another batch.
      limit: 1,
      strict: true,
      interval: 300
    })

    Audnexus._instance = this
  }

  authorASINsRequest(name, region) {
    name = encodeURIComponent(name)
    const regionQuery = region ? `&region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors?name=${name}${regionQuery}`

    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    const throttle = this.limiter(() => axios.get(authorRequestUrl))
    return throttle().then((res) => res.data || [])
      .catch((error) => {
        Logger.error(`[Audnexus] Author ASIN request failed for ${name}`, error)
        return []
      })
  }

  authorRequest(asin, region) {
    asin = encodeURIComponent(asin)
    const regionQuery = region ? `?region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors/${asin}${regionQuery}`

    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    const throttle = this.limiter(() => axios.get(authorRequestUrl))
    return throttle().then((res) => res.data)
      .catch((error) => {
        Logger.error(`[Audnexus] Author request failed for ${asin}`, error)
        return null
      })
  }

  async findAuthorByASIN(asin, region) {
    const author = await this.authorRequest(asin, region)

    return author ?
      {
        asin: author.asin,
        description: author.description,
        image: author.image || null,
        name: author.name
      } : null
  }

  async findAuthorByName(name, region, maxLevenshtein = 3) {
    Logger.debug(`[Audnexus] Looking up author by name ${name}`)

    const asins = await this.authorASINsRequest(name, region)
    const matchingAsin = asins.find(obj => levenshteinDistance(obj.name, name) <= maxLevenshtein)

    if (!matchingAsin) {
      return null
    }

    const author = await this.authorRequest(matchingAsin.asin)
    return author ?
      {
        description: author.description,
        image: author.image || null,
        asin: author.asin,
        name: author.name
      } : null
  }

  getChaptersByASIN(asin, region) {
    Logger.debug(`[Audnexus] Get chapters for ASIN ${asin}/${region}`)

    const throttle = this.limiter(() => axios.get(`${this.baseUrl}/books/${asin}/chapters?region=${region}`))
    return throttle().then((res) => res.data)
      .catch((error) => {
        Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}/${region}`, error)
        return null
      })
  }
}

module.exports = Audnexus
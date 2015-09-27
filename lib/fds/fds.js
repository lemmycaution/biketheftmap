/**
 * Foreign data source wrapper
 * @class
 */
FDS = class FDS {

  /**
   * Generates dates starting from today to go back TIMESPAN_IN_MONTHS.
   * @static
   * @return {Array} list of {Date} objects
   */
  static get queryDates () {
    let dates = [], date, i
    for (i = 0; i < C.TIMESPAN_IN_MONTHS; i++) {
      date = new Date()
      // set date to beginning of the day
      date.setHours(0);date.setMinutes(0);date.setMilliseconds(0)
      date.setMonth(date.getMonth() - i)
      dates.push(date)
    }
    return dates
  }

  /** 
   * Base api url.
   * @abstract
   */
  get apiUrl () {
    throw new Error('Not Implemented')
  }

  /**
   * Fetches results from external api.
   * @param {Object} params
   * @params {Function} callback
   */
  fetch (params, callback) {
    HTTP.get(this.apiUrl, {params: params}, (err, resp) => {
      if (resp.statusCode === 200) {
        callback(null, this.parse(resp.data))
      } else {
        callback(err, resp)
      }
    })
  }

  /** 
   * Parses api response.
   * @abstract
   * @param {Object} data
   * @see {@link http://docs.meteor.com/#/full/http}
   */
  parse (data) {
    throw new Error('Not Implemented')
  }

  /**
   * Transforms single object from api response to geoJSON
   * @abstract
   * @param {Object} doc
   */
  transform (doc) {
    throw new Error('Not Implemented')
  }
}
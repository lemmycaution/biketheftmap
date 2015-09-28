/**
 * Foreign data source wrapper for GB
 * Source: http://data.police.uk
 * @class
 */
FDS.GB = class FdsGB extends FDS {

  get apiUrl () {
    return 'https://data.police.uk/api/crimes-street/bicycle-theft'
  }

  fetch (params, callback) {
    // data.police.uk needs date formatted as 'YYYY-MM'
    // javascript month stars from 0 so add 1
    params.date = `${params.date.getFullYear().toString()}-${(params.date.getMonth() + 1).toString()}`
    console.log(`requesting ${this.apiUrl} params:`, params)
    super(params, callback)
  }

  parse (data) {
    return data.map((doc) => {return this.transform(doc)})
  }
  
  /**
   * Sample response
   * @param {Object} doc
   * Example;
   * {
   *   category: "bicycle-theft",
   *   persistent_id: "aebd220e869a235ba92cde43f7e0df29001573b3df1b094bb952820b2b8f44b0",
   *   location_type: "Force",
   *   location_subtype: "",
   *   id: 20604632,
   *   location: {
   *     latitude: "52.6271606",
   *     longitude: "-1.1485111"
   *     street: {
   *       id: 882208,
   *       name: "On or near Norman Street"
   *     },
   *   },
   *   context: "",
   *   month: "2013-01",
   *   outcome_status: {
   *     category: "Under investigation",
   *     date: "2013-01"
   *   }
   * }
   * @return {Feature}
   */
  transform (doc) {
    let date = doc.month.split('-')
    return Feature.transform({
      lat: doc.location.latitude, 
      lng: doc.location.longitude,
      properties: {
        id: doc.persistent_id,
        date: new Date(`${date[0]}-${date[1]}-01`),
        owner: 'GB'
      }
    })
  }
}
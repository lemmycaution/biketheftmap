/**
 * Standard geoJSON data model
 */
Feature = class Feature {

  /**
   * @static
   * @param {Object} lat, lng, date, category
   * @return {Object} feature
   * {
   *   "type": "Feature",
   *   "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
   *   "properties": {"id": "xyz", "category": "bicycle-theft","date" : ISODate("2015-06-01T00:00:00Z")}
   * }
  */
  static transform ({lat, lng, properties}) {
    check(lat)
    check(lng)
    check(properties, Object)
    
    properties.date = properties.date || new Date()
    properties.category = properties.category || 'bicycle-theft'
    properties.meta = properties.meta || {}

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          parseFloat(lat),
          parseFloat(lng)
        ]
      },
      properties: properties
    }
  }

  static createIfNotExists (feature) {
    // check(feature, {
    //   type: String,
    //   geometry: {type: String, coordinates: [Number, Number]},
    //   properties: {id: String, category: String, date: Date}
    // })
    if (!Features.findOne({'properties.id': feature.properties.id})) Features.insert(feature)
  }

  constructor (doc) {
    _.extend(this, doc)
  }
}

Features = new Mongo.Collection('features', {
  transform: function (doc) { return new Feature(doc) }
})

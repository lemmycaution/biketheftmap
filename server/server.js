if (Meteor.isServer) {

  const MAX_DISTANCE = 1600 / 2 // 0.5 mile in meters

  // ensure index for geo spatial search
  Meteor.startup(() => {
    Features._ensureIndex({geometry: "2dsphere"})
  })

  // server: publish street level bicycle theft crimes as features for location and date
  Meteor.publish('features', function (params) {
    let countryCode, startDate, endDate, features, fds, handle

    check(params, {lat: Number, lng: Number, countryCode: String})

    //TODO: get country code by location
    countryCode = params.countryCode
    delete params.countryCode

    // today
    endDate = new Date()
    // FDS.TIMESPAN_IN_MONTHS back from today
    startDate = new Date()
    startDate.setMonth(startDate.getMonth() - FDS.TIMESPAN_IN_MONTHS)

    // find cached data from local db
    features = Features.find({
      'geometry': {
        $nearSphere: {
          $geometry: {
            type : "Point",
            coordinates : [params.lat, params.lng]
          },
          $maxDistance: MAX_DISTANCE
        }
      },
      'properties.date': {$gt: startDate, $lte: endDate}
    })

    // has foreign data source for country?
    fds = FDS[countryCode] ? new FDS[countryCode] : null

    // fetch from fds if there is no cached data and fds exists for country
    if (features.count() === 0 && fds) {
      // we need to store handle to publish crimes data after fetching via fds
      handle = features.observeChanges({
        added: (id, doc) => { this.added('features', id, doc) }
      })
      // fetch from fds for specific dates
      FDS.queryDates.forEach((date, i, dates) => {
        // update request params with date
        params.date = date
        // get actual crimes in standardized format
        fds.fetch(params, (error, features) => {
          if (error) {
            console.error('fds.fetch failed', error)
            return false
          }
          // insert new features to local db
          features.forEach((feature) => Feature.createIfNotExists(feature))
          // if all dates fetched then publish to client
          if (i === dates.length - 1) this.ready()
        })
      })
      // stop publisher when client unsubscribe
      this.onStop(() => handle.stop())

    // return existing crimes form local db
    } else {
      return features
    }
  })
}
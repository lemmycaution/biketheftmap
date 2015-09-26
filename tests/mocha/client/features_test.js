if (!(typeof MochaWeb === 'undefined')){
  MochaWeb.testOnly(function () {
    describe('Features', function () {
      it('should transform doc to geoJSON feature', function () {
        var feature = Feature.transform({lat: 102.0, lng: 0.5, id: 'test'})
        var expected = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [102.0, 0.5]
          },
          properties: {
            id: 'test',
            category: 'bicycle-theft',
            date: feature.properties.date
          }
        }
        chai.assert.deepEqual(expected, feature)
      })
    })
    describe('Publish/Subscribe Features', function(){
      it('it should publish/subscribe features by location', function (done) {
        this.timeout(10000)
        Meteor.subscribe(
          'features',
          {countryCode: 'GB', lat: 51.536809, lng: -0.064903},
          {
            onReady: function () {
              chai.assert.isAbove(Features.find().count(), 0)
              done()
            }
          }
        )
      })
    })
  })
}

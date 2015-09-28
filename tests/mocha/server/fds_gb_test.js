if (!(typeof MochaWeb === 'undefined')){
  MochaWeb.testOnly(function () {
    describe('FdsGB', function () {
      this.timeout(10000)
      it('should fetch bicyle-theft crime data for last 6 months from data.police.uk', function (done) {
        var fds = new FDS.GB()
        var date = new Date()
        date.setYear(2013)
        date.setMonth(4)
        fds.fetch({lat: 52.629729, lng: -1.131592, date: date}, function (error, features) {
          chai.assert.isArray(features)
          done()
        })
      })
    })
  })
}

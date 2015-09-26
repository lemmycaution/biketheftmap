if (!(typeof MochaWeb === 'undefined')){
  MochaWeb.testOnly(function(){
    describe('FDS', function(){
      it('should have static member with the value of Date array', function () {
        chai.assert.isArray(FDS.queryDates)
        chai.assert.instanceOf(FDS.queryDates[0], Date)
      })
    })
  })
}

C = (function(){
  const Constants = {
    // Map related stuff
    MAP_KEY: 'pk.eyJ1Ijoib251cnV5YXIiLCJhIjoiWDVxcEFPQSJ9.J0rUBNRgkBeLFwr0Kzjt-g',
    MAP_ID: 'onuruyar.njhf3552',
    MAP_ZOOM: 18,
    MAP_PLUGINS: ['markercluster', 'turf' , 'heat', /*'directions'*/],

    // Session vars
    ACTIVE_LOCATION: 'activelocation',
    ACTIVE_FEATURE: 'activefeature',
    FEATURE_UPDATED: 'featureupdated',
    THEFT_COUNT: 'theftcount',

    GEONAMES_USERNAME: 'onuruyar',

    COUNT_DISTANCE: 200,
    COUNT_UNIT: 'meters',

    SEARCH_UNIT: 'miles',
    SEARCH_DIST: 1600 / 2, // mile
    
    TIMESPAN_IN_MONTHS: 6,
    TEHFT_TRESHOLD: 100
  }
  return Constants
})()
C = (function(){
  const Constants = {
    // Map related stuff
    MAP_KEY: 'pk.eyJ1Ijoib251cnV5YXIiLCJhIjoiWDVxcEFPQSJ9.J0rUBNRgkBeLFwr0Kzjt-g',
    MAP_ID: 'dara.041ae67f',
    MAP_ZOOM: 20,
    MAP_PLUGINS: ['markercluster', 'turf' /*, 'heat', 'directions'*/],

    // Session vars
    ACTIVE_LOCATION: 'activelocation',
    ACTIVE_FEATURE: 'activefeature',
    FEATURE_UPDATED: 'featureupdated',
    THEFT_COUNT: 'theftcount',

    GEONAMES_USERNAME: 'onuruyar',

    COUNT_DISTANCE: 200,
    COUNT_UNIT: 'meters'
  }
  return Constants
})()
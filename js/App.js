var mod = angular.module('TestApp', ['ngMaterial']);
mod.config(function($mdThemingProvider) {
    $mdThemingProvider.theme("default")
        .primaryPalette("blue")
        .accentPalette("cyan");
});

var ready = false;
function initMap() {
    ready = true;
}

mod.controller("AppCtrl", function($scope, $timeout, $mdSidenav) {
    a = $scope;
    b = $mdSidenav;
    $scope.toggleLeft = buildToggler("left");
    function buildToggler(componentId) {
        return function() {
            $mdSidenav(componentId).toggle();
        }
    }

    $scope.searchText = "";
    $scope.List = ["28A", "28B", "28C"];
    // When item changes, show whats needed
    $scope.searchItemChange = function(item) {
        if(item) {
            var test = item.match(/^([\w\-]+)/g)[0];
            if(test.length >= 4 && Number(test) == test) {
                //Search item is a bus stop
                $scope.Map.setStopTarget(test);
            } else {
                //Search item is a bus
                for(var i in $scope.Map.BusList) {
                    var cur = $scope.Map.BusList[i];
                    if(cur.LineRef + " " + cur.OriginName + " - " + cur.DestinationName == item) {
                        $scope.Map.setBusTarget(cur);
                    }
                }
            }
        }
    }
    // When searching, show all fitting items
    $scope.querySearch = function(query) {
        var results = query ? $scope.List.filter(createFilterFor(query)) : $scope.List;
        return results;
    }

    function createFilterFor(query) {
        var cased = angular.uppercase(query);
        return function filterFn(val) {
            return (angular.uppercase(val).indexOf(cased) != -1);
        };
    }

    // Update function
    function loop() {
        $scope.Map.getBusses();
        var busNames = [];
        for(var i in $scope.Map.BusList) {
            var cur = $scope.Map.BusList[i];
            busNames.push(cur.LineRef + " " + cur.OriginName + " - " + cur.DestinationName);
        }
        // Show all busses before listing stops
        $scope.List = busNames.sort().concat($scope.Map.Stops);
        $timeout(loop, 1000);
    }

    // Wait for google map API to load
    function waitForMap() {
        if (!ready) {
            $timeout(waitForMap, 100);
        } else {
            $scope.Map = new GMap($mdSidenav);
            loop();
        }
    }
    waitForMap();
});

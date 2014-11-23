angular.module('linksupp').controller('mainController', ['$scope', '$location', '$modal', '$http', 'mealService', 'userService',
	function ($scope, $location, $modal, $http, mealService, userService) {
		/* GLOBAL DATA (In main-controller.js) START */
		$scope.placedMarkers = [];
		$scope.placedSearchMarkers = [];
		$scope.willBeDeletedMarkers = [];
		$scope.lastPosition = new google.maps.LatLng();
		$scope.dataBase = [];
		$scope.usersMealsAttending = [];
		$scope.selectedMarkerOldIcon = null;
		$scope.staffPicks = [];
		$scope.mapUpdater =null;
		// TEST NG-SHOW BOOLEAN FOR LEAVING MEAL IN main.html
		$scope.attendingMeal = false;
		$scope.mealTime = new Date();


		var radius = 3000;
		var lastZoomLevel = 13;
		$scope.noMeals = true;

		var minZoomLevel = 13; // as far back as they can go
		$scope.currentPin = { "name": "",
							  "place": null,
							  "placeImgUrl": null,
							  "marker": null,
							  "rating": "",
							  "friends": [],
							  "meals": [ /*{ "time": "",
							  			     "key": "",
							  			     "attendees": [] }*/
							  		   ]
							};

		/* GLOBAL DATA (In main-controller.js) END */

		/* MAIN.HTML REFRESH CODE START (called on page refresh) */
		// Set the navbar to display the proper elements
		$scope.toggleUtilityButtons(true);

		if (sessionStorage.facebookID == null || sessionStorage.facebookID == 'null') {
			$scope.toggleLogoutButton(false);
			$scope.toggleLoginButton(true);
		}
		else {
			$scope.toggleLogoutButton(true);
			$scope.toggleLoginButton(false);
		}

		// Hide the sidebar on page load, then load the "intro" sidebar content
		$scope.setSidebarContent('staff');
		/* MAIN.HTML REFRESH CODE END */

		// initForm populates local variables from local JSON files.  This speparates
		// a lot of data from html and Angular into appropriate JSON files.  The
		// following "gets" allow angular to access these local JSON files
		$scope.initLoginForm = function() {
			$http.get('/json/occupations.json').success( function(data) {
				$scope.occupations = data.occupations;
			});
			$http.get('/json/dateRanges.json').success( function(data) {
				$scope.dateRanges = data.dateRanges;
			});
			$http.get('/json/meFactors.json').success( function(data) {
				$scope.meFactorAdjs = data.meFactorAdjs;
				$scope.meFactorVerbs = data.meFactorVerbs;
				$scope.meFactorNouns = data.meFactorNouns;
			});
		};

		// This function submits the user data to the database, and redirects the user
		$scope.submitUserData = function() {
			// $scope.submittingUser = true;
			var name = null;
			var facebookKey = null;
			var email = null;
			if (sessionStorage.name) {
				name = sessionStorage.name;
				if (sessionStorage.facebookID) {
					facebookKey = sessionStorage.facebookID;
					if (sessionStorage.email) {
						email = sessionStorage.email;
					}
				}
			}
			var description = getDescriptionFromStrings($scope.description1, $scope.description2, $scope.description3);
			if ( description == 'badUserForm' ) {
				$scope.tellUser('You need to Describe Yourself!', 'Incomplete Form');
			}
			else if (!$scope.dateRange) {
				$scope.tellUser('Don\'t worry about it, we\'ll keep your age a secret!', 'Incomplete Form');
			}
			else if (!$scope.occupation) {
				$scope.tellUser('Sorry we didn\'t supply "Neglectful Form Filler" as an option, please select one of the supplied options', 'Incomplete Form');
			}
			else {
				userService.addNewUser(name, facebookKey, $scope.dateRange, description, $scope.occupation, email, 0).success( function(data) {
					$scope.declareUser(data);
					$scope.toggleLogoutButton(true);
					$scope.toggleLoginButton(false);
					$('#userInformationModal').modal('hide');
					$scope.tellUser('You can now Create and Join meals!', 'Your Information Has Been Saved');
				});
			}
		}

		var mapOptions = {
			zoomControlOptions: {
        		style: google.maps.ZoomControlStyle.LARGE,
        		position: google.maps.ControlPosition.RIGHT_CENTER},
        	panControlOptions: {
        		position: google.maps.ControlPosition.RIGHT_CENTER},
        	zoom: 13,
			streetViewControl: false
        }

		// Adds a Friend
		$scope.addFriend = function(newMealBuddy) {
			$scope.newMealBuddy = "";
			var userKey = angular.fromJson($scope.user).key;
			userService.getMealBuddies(userKey).success(function(mealBuddies) {
				userService.addMealBuddy(newMealBuddy, mealBuddies, userKey).success(function() {
					$scope.populateMealBuddies();
				});
			});
		}

		$scope.isUserInDatabase = function () {
			return ($scope.user != null);
		}

		$scope.isUserLoggedIn = function() {
			return (sessionStorage.facebookID != undefined && sessionStorage.facebookID != 'null');
		}

		$scope.updateMealInfo = function(place, marker) {
	
			$scope.currentPin.name = place.name;
			$scope.currentPin.place = place;
			$scope.currentPin.marker = marker;
			$scope.currentPin.meals = [];

			if(place.photos){				
				$scope.currentPin.placeImgUrl = place.photos[0].getUrl({'maxwidth': 350, 'maxHeight': 350});
			}
			else{
				$scope.currentPin.placeImgUrl = "/img/logo-banner.png";
			}

			//Force minutes to start at 00
			var d = new Date();
			d.setMinutes(0);
			d.setHours(d.getHours() + 1);
			$scope.mealTime = d;

			// Populate $scope.currentPin.meals
			mealService.getMealsAtPlaceID(place.place_id).success(function(data) {
				var mealData = angular.fromJson(data);
				$scope.currentPin.meals = [];  // Reset data
				$scope.noMeals = true;
				if (mealData.length > 0) {
					$scope.noMeals = false;
				}
				for (var i = 0; i < mealData.length; i++) {
					$scope.currentPin.meals.push({"time": "", "key": "", "attendees": []});

					/* DATE CALCULATION START */
					// Date(year, month, day, hours, minutes)
					var mealDate = new Date(mealData[i].time.substring(0, 4),
											(parseInt(mealData[i].time.substring(5, 7)) - 1),
											mealData[i].time.substring(8, 10),
											mealData[i].time.substring(11, 13),
											mealData[i].time.substring(14, 16));
					var hourOffset = Math.floor(480 / 60);
					var minuteOffset = (480 % 60);
					var hour = (((mealDate.getHours() - hourOffset) + 24) % 24);
					var minute = (((mealDate.getMinutes() - minuteOffset) + 60) % 60);
					minute = minute.toString();

					// Convert "0" into "00"
					if (minute.length == 1) {
						minute = "0" + minute;
					}

					// Set AM or PM
					var meridiem = "am";
					if (hour >= 12) {
						meridiem = "pm";
					}

					// Set 24 hour to 12 hour
					hour = (hour % 12);
					if (hour == 0) {
						hour = 12;
					}

					hour = hour.toString();
					/* DATE CALCULATION END */
					$scope.currentPin.meals[i].time = hour + ":" + minute + " " + meridiem;
					$scope.currentPin.meals[i].key = mealData[i].key;
					$scope.currentPin.meals[i].attendingMeal = false;
					$scope.populateAttendees(mealData, i);
				}
			});
			$scope.setSidebarContent('meals');
		}

		$scope.populateAttendees = function(mealData, i) {
			for (var j = 0; j < mealData[i].people.length; j++) {
				userService.getUserWithID(mealData[i].people[j].key).success(function(attendee) {
					$scope.currentPin.meals[i].attendees.push(attendee[0]);
				});
			}
		}

		$scope.getUsersMealsAttending = function(){
			userService.getUserWithID(angular.fromJson($scope.user).key).success(function(data) {
				$scope.usersMealsAttending = data[0].mealsAttending;
			});
		}

		$scope.isUserAttendingMeal = function(meal){
			for (var i=0; i<meal.attendees.length; i++){
				if ($scope.user == null) {
					return;
				}
				if (meal.attendees[i].key == angular.fromJson($scope.user).key){
					meal.attendingMeal = true;
					break;
				}
			}
		}

		$scope.isThisMe = function(attendee)
		{
			if ($scope.user == null) {
				return false
			}
			return (angular.fromJson($scope.user).key == attendee.key);
		}

		$scope.isThisMyFriend = function(attendee)
		{
			if($scope.currentPin.marker.icon != '/img/restaur_selected_friend.png' &&
				$scope.currentPin.marker.icon != '/img/restaur_going.png') {
				return false;
			}
			else{
				for(index in $scope.mealBuddies){
					if($scope.mealBuddies[index][0].key == attendee.key){
						return true;
					}
				}
			return false;
			}
		}

		$scope.joinMeal = function(meal) {
			// Check if user has given us "Basic Information"
			if ($scope.user == null) {
				// Check if user has logged in with facebook
				if (sessionStorage.facebookID == undefined || sessionStorage.facebookID == 'null') {
					$scope.tellUser('Please log in through Facebook to Join meals', 'Need an Account');
				}
				else {
					$('#userInformationModal').modal();
				}
				return;
			}
			userService.getUserWithID(angular.fromJson($scope.user).key).success(function(data) {
				$scope.usersMealsAttending = data[0].mealsAttending;
				//hard code limit 1
				if($scope.usersMealsAttending.length > 0){
					$scope.tellUser("You are already in a meal.  Please leave your other meal to join a new one.");
					return; // user cannot join
				}
				var key = angular.fromJson($scope.user).key;
				mealService.getMealDetails(meal.key).success(function(dat) {
					if (dat) {
						mealService.addUserToMeal(meal.key, key).success(function(data) {
							$scope.usersMealsAttending = meal;
							$scope.currentPin.marker.setIcon('/img/restaur_going.png');
							$scope.selectedMarkerOldIcon = '/img/restaur_going.png';
							$scope.currentPin.marker.labelContent = parseInt($scope.currentPin.marker.labelContent) + 1;
							$scope.currentPin.marker.label.setContent();
							userService.addMealToUser(meal.key, angular.fromJson($scope.user).key);
							meal.attendees.push(angular.fromJson($scope.user));
						});
					} else {
						$scope.tellUser("Sorry, someone must have left this meal before you joined", "This meal doesn't exist!");
					}
				});
			});
		}

		// Add a check for if user is attending meal
		$scope.leaveMeal = function(meal) {
			if ($scope.currentPin.marker.hasMeal) {
				var key = angular.fromJson($scope.user).key;
				mealService.deleteUserFromMeal(meal.key, key).success( function(data) {
					// Check if anyone is there
					if ($scope.currentPin.meals.length == 1 && data.people.length == 0) {
						$scope.currentPin.marker.setIcon('/img/restaur_selected.png');
						$scope.selectedMarkerOldIcon = 'https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0';
						$scope.currentPin.marker.labelContent = '';
						$scope.currentPin.marker.label.setContent();

						mealService.deleteMeal(meal.key);
					}
					else {
						if (data.people.length == 0) {
							mealService.deleteMeal(meal.key);
						}
						// Check if a friend is there
						// Loop through your friends
						break1:
						for (var i = 0; i < $scope.mealBuddies.length; i++) {
							for (var j = 0; j < $scope.mealBuddies[i][0].mealsAttending.length; j++) {
								if ($scope.mealBuddies[i][0].mealsAttending[j].key.substring(0, 28) == meal.key.substring(0, 28)) {
									$scope.currentPin.marker.setIcon('/img/restaur_selected_friend.png');
									$scope.selectedMarkerOldIcon = '/img/restaur_friend.png';
									break break1;
								}
							}
						}

						if ($scope.selectedMarkerOldIcon != '/img/restaur_friend.png') {
							$scope.currentPin.marker.setIcon('/img/restaur_selected.png');
							$scope.selectedMarkerOldIcon = '/img/restaurant.png';
						}
						$scope.currentPin.marker.labelContent = parseInt($scope.currentPin.marker.labelContent) - 1;
						$scope.currentPin.marker.label.setContent();
					}
					userService.getUserWithID(key).success(function(data) {
						userService.deleteMealFromUser(meal.key, key).success( function(data) {
							$scope.tellUser('You have left the ' + meal.time +  ' meal at ' + $scope.currentPin.name + '.',
								'We are sad to see you go!');
							$scope.updateMealInfo($scope.currentPin.place, $scope.currentPin.marker);
						});
					});
				});
			}
		}

		// The following code runs when the userInformationModal closes, so we can tell the user something
		// It doesn't function as expected, and I have no idea why.  Someone take a look at it.
		// $('#userInformationModal').on('hidden.bs.modal', function (event) {
		// 	console.log("HERE");
		// 	if ($scope.user != null) {
		// 		$scope.tellUser('You can now Create and Join meals!', 'Your Information Has Been Saved');
		// 	}
		// })

		$scope.createMeal = function(mealTime) {
			// Check if user has given us "Basic Information"
			if ($scope.user == null) {
				// Check if user has logged in with facebook
				if (sessionStorage.facebookID == undefined || sessionStorage.facebookID == 'null') {
					$scope.tellUser('Please log in through Facebook to Create meals', 'Need an Account');
				}
				else {
					$('#userInformationModal').modal();
				}
				return;
			}

			userService.getUserWithID(angular.fromJson($scope.user).key).success(function(data) {
				$scope.usersMealsAttending = data[0].mealsAttending;

				// Users are not allow to join more than 1 meal at a time
				if($scope.usersMealsAttending.length > 0){
					$scope.tellUser("You are already in a meal.  Please leave your other meal to create a new meal.");
					return; // user cannot join
				}
				var currentTime = new Date();
				var date = new Date(currentTime.getFullYear(),
									currentTime.getMonth(),
									currentTime.getDate(),
									mealTime.getHours(),
									mealTime.getMinutes(), 0, 0);
				if (currentTime > date) {
					$scope.tellUser("You've tried to create a meal at a time that has already passed. You can only create meals for this day - if you're trying to create a meal for tomorrow, please try again after midnight.",
					"We have to stop living in the past!");
					return;
				}
				//$scope.currentPin.position
				mealService.addNewMeal($scope.currentPin.place.place_id, 0, $scope.currentPin.marker.position.lat(), $scope.currentPin.marker.position.lng(), date, [], true).success(function(data) {
					var key = angular.fromJson($scope.user).key;

					mealService.addUserToMeal(data.key, key).success(function(meal) {
						$scope.usersMealsAttending[0] = data;
						$scope.currentPin.marker.setIcon('/img/restaur_going.png');
						$scope.selectedMarkerOldIcon = '/img/restaur_going.png';
						$scope.currentPin.marker.hasMeal = true;
						if ($scope.currentPin.marker.labelContent == "") {
							$scope.currentPin.marker.labelContent = 1;
						}
						else {
							$scope.currentPin.marker.labelContent = (parseInt($scope.currentPin.marker.labelContent) + 1 );
						}
						$scope.currentPin.marker.label.setContent();
						userService.addMealToUser(meal.key, angular.fromJson($scope.user).key);
						$scope.updateMealInfo($scope.currentPin.place, $scope.currentPin.marker);
					})
				});
			});
		}

		$scope.removeMealBuddy = function(mealBuddy) {
			userService.deleteMealBuddy(mealBuddy[0].key, angular.fromJson($scope.user).key).success(function(data) {
				$scope.populateMealBuddies();
			});
		}

		$scope.confirmMealBuddy = function(mealBuddyRequest) {
			userService.confirmMealBuddy(mealBuddyRequest[0].key, angular.fromJson($scope.user).key).success(function(data) {
				$scope.populateMealBuddies();
			});
		}

		$scope.addFriendFromFacebookID = function(facebookID){
			userService.findByFacebook(facebookID).success(function(data) {
				$scope.addFriend(data[0].key);
			});
		}

		$scope.loadSuggestions = function() {
			$scope.findingFriends = true;
			FB.api(
				"/me/friends",
				function (response) {
					if (response && !response.error) {
						/* handle the result */
						var userKey = angular.fromJson($scope.user).key;
						userService.getMealBuddies(userKey).success(function(mealBuddies) {
							for (var i = 0; i < response.data.length; i++) {
								var fbFriend = response.data[i];
								userService.findByFacebook(fbFriend.id).success(function(data) {
									userService.suggestMealBuddy(data[0].key, mealBuddies, userKey);
								});
							}
						});
  					}
				}
			);
			setTimeout(function() {
				$scope.populateMealBuddies();
				$scope.findingFriends = false;
			}, 1000);
		}

		// initializes the google map and populates it with food places
		$scope.initialize = function() {
		
			$scope.map = new google.maps.Map(document.getElementById('mapCanvas'), mapOptions);
			if ($scope.user != null) {
				$scope.populateMealBuddies();
				$scope.getUsersMealsAttending();
			}
			$scope.lastPosition = new google.maps.LatLng(48.4449579, -123.33535710000001);   // This is the default position if Geolocation is enabled it is overwritten to the users location
			handleNoGeolocation(true);
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(position) {
					var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
				    $scope.map.setCenter(pos);

				}, function() {
					handleNoGeolocation(true);
				});
			} else {
				handleNoGeolocation(false); // not compatable with browswer I think
			}

			//IF geolocation was succesfull then map center will not be undefined, but if its not then we know they dont have geolocation enabled and mustthen keep the default location
			if( typeof $scope.map.getCenter() != 'undefined'){
				$scope.lastPosition = $scope.map.getCenter();
			}

			//Form request for location search
			var firstRequest = {
				location: $scope.lastPosition,
				rankby : google.maps.places.RankBy.DISTANCE,
				radius: radius,
				types: ['restaurant','cafe']
			};

				//Form request for location search
			var request = {
				location: $scope.lastPosition,
				rankby : google.maps.places.RankBy.DISTANCE,
				bounds: $scope.map.getBounds(),
				types: ['restaurant','cafe']
			};

			var service = new google.maps.places.PlacesService($scope.map);
			setStaffPickData();
			placeAllMarkers();
		
			$scope.mapUpdater = setInterval(function(){updateMap()}, 30000); //Every 30 seconds, delete all markers, download whole database, create new markers
			// refreshes the map with new food places when the map is moved a certain amount
		/*	google.maps.event.addListener($scope.map, 'bounds_changed', function() {
				if(google.maps.geometry.spherical.computeDistanceBetween($scope.lastPosition, $scope.map.getCenter()) > radius/3){
					request.bounds = $scope.map.getBounds();
					$scope.populateMealBuddies();
					$scope.lastPosition = $scope.map.getCenter();
					request.location=offsetCenter($scope.map.getCenter(),-radius/10,-radius/10);
					service.radarSearch(request, fastCallback);
					//service.radarSearch(request, smoothUpdateCallback);  //smooth update wont work anymore without some special consideration of the aysc ness
				}
			});
*/
			// Limit the zoom level
		/*	google.maps.event.addListener($scope.map, 'zoom_changed', function() {

				if ($scope.map.getZoom() < minZoomLevel){
					$scope.map.setZoom(minZoomLevel);
					return;
				}
				var bounds = $scope.map.getBounds();
				var sw = bounds.getSouthWest();
				var ne = bounds.getNorthEast();

				var screenWidthMeters = google.maps.geometry.spherical.computeDistanceBetween (sw, ne);
				request.bounds = $scope.map.getBounds();

					request.radius = radius;
					$scope.lastPosition = $scope.map.getCenter();

					request.location=offsetCenter($scope.map.getCenter(),radius/4,radius/4);
					//service.radarSearch(request, fastCallback);
					
				});*/

			initializeSearchBar();
		}

		function offsetCenter(latlng,offsetx,offsety) {

			// latlng is the apparent centre-point
			// offsetx is the distance you want that point to move to the right, in pixels
			// offsety is the distance you want that point to move upwards, in pixels
			// offset can be negative
			// offsetx and offsety are both optional

			var scale = Math.pow(2, $scope.map.getZoom());
			var nw = new google.maps.LatLng(
				$scope.map.getBounds().getNorthEast().lat(),
				$scope.map.getBounds().getSouthWest().lng()
			);

			var worldCoordinateCenter = $scope.map.getProjection().fromLatLngToPoint(latlng);
			var pixelOffset = new google.maps.Point((offsetx/scale) || 0,(offsety/scale) ||0)

			var worldCoordinateNewCenter = new google.maps.Point(
				worldCoordinateCenter.x - pixelOffset.x,
				worldCoordinateCenter.y + pixelOffset.y
			);

			var newCenter = $scope.map.getProjection().fromPointToLatLng(worldCoordinateNewCenter);

			return newCenter;
		}

		// initializes and adds the search bar on the map
		initializeSearchBar = function() {
		
			// Create the search box and link it to the UI element.
			var input = /** @type {HTMLInputElement} */(
		    	document.getElementById('pac-input'));

			$scope.map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);

			var searchBox = new google.maps.places.SearchBox(
    		/** @type {HTMLInputElement} */(input));

    		// Listen for the event fired when the user selects an item from the
			// pick list. Retrieve the matching places for that item.
			google.maps.event.addListener(searchBox, 'places_changed', function() {
				var places = searchBox.getPlaces();

				if (places.length == 0) {
				  return;
				}

				clearSearchMarkers(); //Clear search markers
				
				// For each place, get the icon, place name, and location.
				var bounds = new google.maps.LatLngBounds();

				for (var i = 0, place; place = places[i]; i++) {
					createSearchMarker(place);
					bounds.extend(place.geometry.location); //update aggregate bounds
				}
				$scope.map.fitBounds(bounds);
				$scope.map.setZoom(15);
			});

			// Bias the SearchBox results towards places that are within the bounds of the
			// current map's viewport.
			google.maps.event.addListener($scope.map, 'bounds_changed', function() {
		    	var bounds = $scope.map.getBounds();
		    	searchBox.setBounds(bounds);
			});
		}

		
	setStaffPickData = function(){
	
		//PLACE ID:
		// Lat
		// LNG
		$scope.staffPicks = [
			
			//Felicita's Pub,
			[
			"ChIJ0V0mUoV0j1QRzTZ7n46_lVU",
			48.465034,
			-123.30817300000001,
			],
		
			//Bin 4 Burger Lounge,
			[
			"ChIJo84EMY90j1QRc1_M3vZH008",
			48.425204,
			-123.356989,
			],
			
			//Pho Boi (Fort Street),
			[ "ChIJ1VgF-490j1QRzCl97_xiRwE",
			48.424287,
			-123.36355400000002,
			]
			//Prima Strada Pizzeria(Cook Street),
			,[ "ChIJ_dqgaXlzj1QRcCuocUFfOYo",
			48.414001,
			-123.35702700000002,
			]
			//Pig BBQ Joint (Downtown),
			,[ "ChIJ71eiX4V0j1QR5eilmkVgoGA",
			48.426808,
			-123.36186499999997,
			]
			//Maude Hunter's Pub,
			,[ "ChIJddqw3eVzj1QRU6olvYEGQ0U",
			48.462462,
			-123.33311800000001,
			]
			//Foo Asian Street Food,
			,[ "ChIJEQZYd4V0j1QRItiWO8aOx5o",
			48.42571,
			-123.36255499999999,
			]
			//Noodle Box (Uptown),
			,[ "ChIJexReD6Jzj1QRl3OXqtP60LA",
			48.454071,
			-123.37576899999999,
			]
			//Vis-a-Vis,
			,[ "ChIJkwa9BEF0j1QRuyLcZZ-vKkg",
			48.426599,
			-123.314975,
			]
			//Hillside Coffee and Tea,
			,[ "ChIJN2zJW3V0j1QRARHjmDjMq9g",
			48.445027,
			-123.33439699999997,
			]
			//La Taquisa (Esquimalt),
			,[ "ChIJJwDDUGJzj1QR7J26pcSNzoo",
			48.432653,
			-123.381057,
			]
			//Spinnakers Gastro Brewpub,
			,[ "ChIJ8UwCKJ50j1QRykJnBrbQRM0",
			48.429282,
			-123.38452799999999,
			]
			//Hecklers Bar and Grill,
			,[ "ChIJ42-Zs3Fzj1QRn8Pt-HGMaJ4",
			48.443056,
			-123.385962,
			]
			//Beacon Drive In Ltd,
			,[ "ChIJTTkdD8B0j1QRWqg-MLRfPUE",
			48.443056,
			-123.385962,
			]
			//Bon Sushi (Oak Bay),
			,[ "ChIJ22cgcUF0j1QRo--FDGoEkKg",
			48.426098,
			-123.31575399999997,
			]
			//Macchiatto Caffe (Johnson Street),
			,[ "ChIJGdAln5p0j1QRH-saH2_mMJo",
			48.426888,
			-123.361718,
			]
			//Famoso Neopolitan Pizzeria,
			,[ "ChIJG3x3Upt0j1QRDCTKxRHT9xg",
			48.427763,
			-123.36904199999998,
			]
			]
		}
		
		//Places all markers 
		placeAllMarkers = function(){
		
			mealService.getAllMeals().success(function(data){
				$scope.dataBase = null;
				$scope.dataBase =data;
				
				placeStaffPicks();	 //places any staff pick with no meal
				placeMeals();	// places ALL meals
			});
		}
		
		//places all staff picks with no meals
		placeStaffPicks = function(){
		
			var hasMeal = false;
			
			//----Place Staff Picks WITH NO Meal-----
			for (var i = 0; i < $scope.staffPicks.length; i++) {
				hasMeal = false;
				
				//Search dataBase for this staffPick
				for( var x = 0; x < $scope.dataBase.length; x++){
					if(!($scope.dataBase[x].placeID !=  $scope.staffPicks[i][0])){
						hasMeal = true;
						break;
					}
				}
				
				//If no meal was found, create the star marker
				if( !hasMeal){
					createStarMarker(i);	
				}
			}	
		}
	
	
		//For every meal, check if a marker at that loctaion is already placed or nukeAllMarkers
		//Then if its unique getNumber of People
		//Then place a new marker
		placeMeals = function(){
			var placeID;
			for( var i = 0; i < $scope.dataBase.length; i++){
				placeID = $scope.dataBase[i].placeID;
					if( checkNewPlaceID(placeID)){
						placeMealMarker($scope.dataBase[i].lat,$scope.dataBase[i].lng,placeID);
					}	
			}
		}
		
		//placeID is staff pick. If placeID is in staff picks returns true
		checkIsStaffPick = function(placeID){
			for (var i = 0; i < $scope.staffPicks.length; i++) {
				if(!(placeID !=  $scope.staffPicks[i][0])){
					return true; 						//placeID is in staff picks
				}
			}
			return false;	//placeID not in staff picks
		}
		
		
		//If placeID has been placed, return false
		//else return true
		checkNewPlaceID = function(placeID){
			for( var i = 0; i < $scope.placedMarkers.length; i++){
				if( placeID == $scope.placedMarkers.markerId){
					return false;	//meal at this place has been placed
				}
			}
			return true;	//no meal at this place has been placed
		}
		
		getNumberOfPeople = function(placeID){
			var numPeople = 0;
			
			for( var i = 0; i < $scope.dataBase.length; i++){
				
				if( placeID == $scope.dataBase[i].placeID){
					numPeople += $scope.dataBase[i].numPeople;
				}
			}
			return numPeople;
		}
			
		
		updateMap =function(){
			nukeAllMarkers();
			placeAllMarkers();
			checkSelectedMarker();
		}
		
		checkSelectedMarker = function(){
			var found = false;
			for( var i=0; i<$scope.placedMarkers.length; i++){
			
				if( $scope.currentPin.markerId == $scope.placedMarkers[i].markerId){
					found = true;
				}
			}
			
			if(!found){
				console.log("re-place selected on map" ,$scope.currentPin);
				//$scope.placedMarkers.push($scope.currentPin);
			}
		}
		
		
		
		createStarMarker =function(i){
		
			var marker =  new MarkerWithLabel({
				icon: 'https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0',  //Red dot
				map: $scope.map,
				position: new google.maps.LatLng($scope.staffPicks[i][1],$scope.staffPicks[i][2]),
				draggable: false,    //property that allows user to move marker
				raiseOnDrag: false,
				labelAnchor: new google.maps.Point(7, 33),    // anchors to
				labelClass: 'labels', // the CSS class for the label

				// Some additional properties of the markers so we can access them later
				markerId : $scope.staffPicks[i][0],
				hasMeal: false,
			});
			
			$scope.placedMarkers.push(marker); // Array marker
			google.maps.event.addListener(marker, 'click', function() {
				updateMarkerIcon(marker);

				var request = {
					placeId:marker.markerId,
				};
				var service = new google.maps.places.PlacesService($scope.map);
				service.getDetails(request,getPlaceDetails);

				// Returns ALL the place details and information
				function getPlaceDetails(place, status) {
					if (status == google.maps.places.PlacesServiceStatus.OK) {
						$scope.updateMealInfo(place, marker);
					}
				}
			});
		}
		
		
		placeMealMarker= function(lat,lng,placeID){
		
			var userIsGoing = false;
			var numPeople = 0;
			var searchingForBuddy = true;
			var buddyWasFound = false;
			
			//see if user is attending
			if(($scope.usersMealsAttending.length >0 ) &&( $scope.usersMealsAttending[0].key.substring(0,27) == placeID)){
				userIsGoing = true;
			}
			
			//see if user has friends
			if(  $scope.mealBuddies.length == 0 ){
				
				console.log("Problem asyc mealbuddies happens to slow ",$scope.mealBuddies);
				searchingForBuddy = false;
			}
			
			loop1:
			for (var i = 0; i < $scope.dataBase.length; i++) {
			
				//Find if meal is the same location as the pin
				if(!(placeID != $scope.dataBase[i].placeID)){ //not equal faster than equality, odds are majority of meals are not equal which compounds this gain
			
					numPeople += $scope.dataBase[i].numPeople; // increment numPeople
					
					//Find if any of the goers is a friend
					if(searchingForBuddy){
						loop2:
						for( var y = 0; y < $scope.mealBuddies.length; y++){
							loop3:
							for(var z = 0; z < $scope.dataBase[i].people.length; z++){
								if( $scope.mealBuddies[y][0].key == $scope.dataBase[i].people[z].key) {
									buddyWasFound = true;
									searchingForBuddy = false;
									break loop2;
								}
							}
						}
					}
				}
			}

			var icon = '/img/restaurant.png'; //default meal marker

			/*if( buddyWasFound && userIsGoing){
				icon = user is going and buddy
			} else*/
			if( userIsGoing){
				icon = '/img/restaur_going.png';
			}
			else if( buddyWasFound){
				icon = '/img/restaur_friend.png'; // friend going marker
			}

			// This is the Mangiamo Meal marker, ie there is a meal here
			var marker =  new MarkerWithLabel({
				icon: icon,
				map: $scope.map,
				position:  new google.maps.LatLng(lat,lng),
				draggable: false,    //property that allows user to move marker
				raiseOnDrag: false,
				labelContent:numPeople,
				labelAnchor: new google.maps.Point(7, 33),    // anchors to
				labelClass: "labels", // the CSS class for the label

				// Some additional properties of the markers so we can access them later
				markerId :placeID,
				hasMeal: true,
			});

			$scope.placedMarkers.push(marker); // Array marker
			google.maps.event.addListener(marker, 'click', function() {
				updateMarkerIcon(marker);

				var request = {
					placeId:marker.markerId,
				};
				var service = new google.maps.places.PlacesService($scope.map);
				service.getDetails(request,getPlaceDetails);

				// Returns ALL the place details and information
				function getPlaceDetails(place, status) {
					if (status == google.maps.places.PlacesServiceStatus.OK) {
						$scope.updateMealInfo(place, marker);
					}
				}
			});
		}

		
		createSearchMarker = function(place){
		
				var image = {
						url: place.icon,
						size: new google.maps.Size(71, 71),
						origin: new google.maps.Point(5, -15),
						anchor: new google.maps.Point(17, 34),
						scaledSize: new google.maps.Size(25, 25)
					};

				var marker =  new MarkerWithLabel({
					icon: image,
					map: $scope.map,
					position: place.geometry.location,
					draggable: false,    //property that allows user to move marker
					raiseOnDrag: false,
					//labelContent: , 
					labelAnchor: new google.maps.Point(7, 33),    // anchors to
					labelClass: 'labels', // the CSS class for the label

					// Some additional properties of the markers so we can access them later
					markerId : place.place_id,
					hasMeal: false,
				});
			
				google.maps.event.addListener(marker, 'click', function() {
					updateMarkerIcon(marker);

					var request = {
						placeId:marker.markerId,
					};
					var service = new google.maps.places.PlacesService($scope.map);
					service.getDetails(request,getPlaceDetails);

					// Returns ALL the place details and information
					function getPlaceDetails(place, status) {
						if (status == google.maps.places.PlacesServiceStatus.OK) {
							$scope.updateMealInfo(place, marker);
						}
					}
				});
				
				$scope.placedSearchMarkers.push(marker);
		}
		
		
		

		createDotMarker = function(place){
			var marker =  new MarkerWithLabel({
				icon: 'https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0',  //Red dot
				map: $scope.map,
				position: place.geometry.location,
				draggable: false,    //property that allows user to move marker
				raiseOnDrag: false,
				labelContent: 0,
				labelAnchor: new google.maps.Point(7, 33),    // anchors to
				labelClass: 'labels', // the CSS class for the label

				// Some additional properties of the markers so we can access them later
				markerId : place.place_id,
				hasMeal: false,
			});
		
			$scope.placedMarkers.push(marker); // Array marker
			google.maps.event.addListener(marker, 'click', function() {
				updateMarkerIcon(marker);

				var request = {
					placeId:marker.markerId,
				};
				var service = new google.maps.places.PlacesService($scope.map);
				service.getDetails(request,getPlaceDetails);

				// Returns ALL the place details and information
				function getPlaceDetails(place, status) {
					if (status == google.maps.places.PlacesServiceStatus.OK) {
						$scope.updateMealInfo(place, marker);
					}
				}
			});
		}



		//paramater is the new selected marker,
		// function updates old marker to its old image, and update new to new image
		updateMarkerIcon = function(marker) {
		  	// At this point, currentPin is still the old marker, so check icons
			// if the old one exists, return it to normal
			if($scope.currentPin.marker != null){
				$scope.currentPin.marker.setIcon($scope.selectedMarkerOldIcon);
			}

			// Update the marker to the new marker
			$scope.currentPin.marker = marker;
			$scope.selectedMarkerOldIcon = marker.icon; // saves the current image so it can be updated next time we enter here

			switch(marker.icon){

			//Red dot
			case 'https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0':
				marker.setIcon('/img/restaur_selected.png');
				break;

			//Normal Meal
			case '/img/restaurant.png':
				marker.setIcon('/img/restaur_selected.png');
				break;
			//Friend going
			case '/img/restaur_friend.png':
				marker.setIcon('/img/restaur_selected_friend.png');
				break;
			//CASE IT IS THE ONE YOU ARE GOING TO
			//CURRENT NO CHANGE
			case '/img/restaur_going.png':
				marker.setIcon('/img/restaur_going.png');
				break;
			}
		}

		// Removes the markers from the map,
		function clearMarkers(){
			for (var i = 0; i < $scope.willBeDeletedMarkers.length; i++ ) {
				$scope.willBeDeletedMarkers[i].setMap(null);
			}
			$scope.willBeDeletedMarkers = [];
		}

		function nukeAllMarkers(){
			for (var i = 0; i < $scope.placedMarkers.length; i++ ) {
				google.maps.event.clearListeners($scope.placedMarkers[i]);
				$scope.placedMarkers[i].setMap(null);
				delete $scope.placedMarkers[i];
			}
			$scope.placedMarkers = [];
		}

		//
		function clearSearchMarkers(){
			for (var i = 0; i < $scope.placedSearchMarkers.length; i++ ) {
				$scope.placedSearchMarkers[i].setMap(null);
			}
			$scope.placedSearchMarkers = [];
		
		}
		
		// In the event that the browser cannot or user chooses not to support geolocation, this is how that's handled
		function handleNoGeolocation(errorFlag) {

			if (errorFlag) {
				// var content = 'EnableGeolocation.';
			} else {
				var content = 'Error: Your browser doesn\'t support geolocation.';
			}

			var options = {
				map: $scope.map,
				position: new google.maps.LatLng(48.4449579, -123.33535710000001),   // This is the position it goes to if the user failed to give permision or, it failed for some other reason
				content: content
			};

			var infowindow = new google.maps.InfoWindow(options);
			$scope.map.setCenter(options.position);
		}

		function unloadScript(){
			google.maps.event.clearInstanceListeners(window);
			google.maps.event.clearInstanceListeners(document);
		}

		$(window).bind('beforeunload', function(e) {
			nukeAllMarkers();
			$scope.map = null;
			google.maps.event.clearInstanceListeners(window);
			google.maps.event.clearInstanceListeners(document);

			$scope.placedMarkers = null;
			$scope.willBeDeletedMarkers = null;
			$scope.lastPosition = null;
			$scope.dataBase = null;
			$scope.selectedMarkerOldIcon = null;
			$scope.usersMealsAttending = null;
		});
}]);

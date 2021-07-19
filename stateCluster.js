/**
 * A State Clusterer that clusters markers.
 *
 * @param {google.maps.Map} map The Google map to attach to.
 * @param {Array.<google.maps.Marker>=} opt_markers Optional markers to add to
 *   the cluster.
 * @param {Object=} opt_options support the following options:
 *     'gridSize': (number) The grid size of a cluster in pixels.
 *     'maxZoom': (number) The maximum zoom level that a marker can be part of a
 *                cluster.
 *     'zoomOnClick': (boolean) Whether the default behaviour of clicking on a
 *                    cluster is to zoom into it.
 *     'averageCenter': (boolean) Wether the center of each cluster should be
 *                      the average of all markers in the cluster.
 *     'minimumClusterSize': (number) The minimum number of markers to be in a
 *                           cluster before the markers are hidden and a count
 *                           is shown.
 *     'styles': (object) An object that has style properties:
 *       'url': (string) The image url.
 *       'height': (number) The image height.
 *       'width': (number) The image width.
 *       'anchor': (Array) The anchor position of the label text.
 *       'textColor': (string) The text color.
 *       'textSize': (number) The text size.
 *       'backgroundPosition': (string) The position of the backgound x, y.
 *       'iconAnchor': (Array) The anchor position of the icon x, y.
 *     'markerWeights': (object) An object that has weights associated with
 *                      each marker type
 *     'stateControl': (object) An object that maintains the state of the
 *               clusters.
 * @constructor
 * @extends google.maps.OverlayView
 */

function StateClusterer(map, opt_markers, opt_options) {
// StateClusterer implements google.maps.OverlayView interface. We use the
// extend function to extend StateClusterer with google.maps.OverlayView
// because it might not always be available when the code is defined so we
// look for it at the last possible moment. If it doesn't exist now then
// there is no point going ahead :)
this.extend(StateClusterer, google.maps.OverlayView);
        this.map_ = map;
        /**
         * @type {Array.<google.maps.Marker>}
         * @private
         */
        this.markers_ = [];
        /**
         *  @type {Array.<DomainCluster>}
         */
        this.clusters_ = [];
        this.sizes = [53, 56, 66, 78, 90];
        /**
         * @private
         */
        this.styles_ = [];
        /**
         * @type {boolean}
         * @private
         */
        this.ready_ = false;
        var options = opt_options || {};
        /**
         * @type {object}
         * @private
         */
        this.markerWeights_ = options['markerWeights'];
        /**
         * @type {object}
         * @private
         */
        this.stateControl_ = options['stateControl'] || null;
        /**
         * @type {object}
         * @private
         */
        this.domainStates_ = options['domainStates'] || null;
        /**
         * @type {string}
         * @private
         */
        this.clusterMetric_ = options['clusterMetric'] || null;
        /**
         * @type {number}
         * @private
         */
        this.currentStateIndex_ = 0;
        /**
         * @type {?number}
         * @private
         */
        this.maxZoom_ = options['maxZoom'] || null;
        this.styles_ = options['styles'] || [];
        /**
         * @type {string}
         * @private
         */
        this.imagePath_ = options['imagePath'] ||
        this.MARKER_CLUSTER_IMAGE_PATH_;
        /**
         * @type {string}
         * @private
         */
        this.imageExtension_ = options['imageExtension'] ||
        this.MARKER_CLUSTER_IMAGE_EXTENSION_;
        /**
         * @type {boolean}
         * @private
         */
        this.zoomOnClick_ = true;
        if (options['zoomOnClick'] != undefined) {
this.zoomOnClick_ = options['zoomOnClick'];
        }

/**
 * @type {boolean}
 * @private
 */
this.averageCenter_ = false;
        if (options['averageCenter'] != undefined) {
this.averageCenter_ = options['averageCenter'];
        }

this.setupStyles_();
        this.setMap(map);
        /**
         * @type {number}
         * @private
         */
        this.prevZoom_ = this.map_.getZoom();
        // Add the map event listeners
        var that = this;
        google.maps.event.addListener(this.map_, 'zoom_changed', function() {
        var zoom = that.map_.getZoom();
                that.prevZoom_ = zoom;
                that.resetViewport();
                var mapCenter = map.getCenter();
                map.setCenter(new google.maps.LatLng((mapCenter.lat() + 0.0000001), mapCenter.lng()));
        });
        google.maps.event.addListener(this.map_, 'idle', function() {
        that.redraw();
        });
        // Finally, add the markers
        if (opt_markers && opt_markers.length) {
this.addMarkers(opt_markers, false);
        }
}


/**
 * The marker cluster image path.
 *
 * @type {string}
 * @private
 */
StateClusterer.prototype.MARKER_CLUSTER_IMAGE_PATH_ = 'images/m';
        /**
         * The marker cluster image path.
         *
         * @type {string}
         * @private
         */
        StateClusterer.prototype.MARKER_CLUSTER_IMAGE_EXTENSION_ = 'png';
        /**
         * Extends a objects prototype by anothers.
         *
         * @param {Object} obj1 The object to be extended.
         * @param {Object} obj2 The object to extend with.
         * @return {Object} The new extended object.
         * @ignore
         */
        StateClusterer.prototype.extend = function(obj1, obj2) {
        return (function(object) {
        for (var property in object.prototype) {
        this.prototype[property] = object.prototype[property];
        }
        return this;
        }).apply(obj1, [obj2]);
        };
        /**
         * Implementation of the interface method.
         * @ignore
         */
        StateClusterer.prototype.onAdd = function() {
        this.setReady_(true);
        };
        /**
         * Implementation of the interface method.
         * @ignore
         */
        StateClusterer.prototype.draw = function() {};
        /**
         * Sets up the styles object.
         *
         * @private
         */
        StateClusterer.prototype.setupStyles_ = function() {
        if (this.styles_.length) {
        return;
        }

        //TODO - setup only required number of styles
        var numOfStyles = parseInt(this.imagePath_[this.imagePath_.length - 1]);
                for (var i = 0; i < numOfStyles; i++) {
        var size = this.sizes[i];
                this.styles_.push({
                url: this.imagePath_ + (i + 1) + '.' + this.imageExtension_,
                        height: size,
                        width: size
                });
        }
        };
        /**
         *  Fit the map to the bounds of the markers in the clusterer.
         */
        StateClusterer.prototype.fitMapToMarkers = function() {
        var markers = this.getMarkers();
                var bounds = new google.maps.LatLngBounds();
                for (var i = 0, marker; marker = markers[i]; i++) {
        bounds.extend(marker.getPosition());
        }

        this.map_.fitBounds(bounds);
        };
        /**
         *  Sets the styles.
         *
         *  @param {Object} styles The style to set.
         */
        StateClusterer.prototype.setStyles = function(styles) {
        this.styles_ = styles;
        };
        /**
         *  Gets the styles.
         *
         *  @return {Object} The styles object.
         */
        StateClusterer.prototype.getStyles = function() {
        return this.styles_;
        };
        /**
         *  Gets the application state object.
         *
         *  @return {object} The application state object.
         */
        StateClusterer.prototype.getDomainStates = function() {
        return this.domainStates_;
        };
        /**
         *  Gets the index of the current state.
         *
         *  @return {number} The index of the current state.
         */
        StateClusterer.prototype.getCurrentStateIndex = function() {
        return this.currentStateIndex_;
        };
        /**
         *  Sets the index of the current state.
         *
         *  @param {number} currentStateIndex   The index of the current state.
         */
        StateClusterer.prototype.setCurrentStateIndex = function(currentStateIndex) {
        this.currentStateIndex_ = currentStateIndex;
        };
        /**
         *  Gets the marker weights.
         *
         *  @return {object} The marker weights object.
         */
        StateClusterer.prototype.getMarkerWeights = function() {
        return this.markerWeights_;
        };
        /**
         *  Gets the state control object.
         *
         *  @return {object} The state control object.
         */
        StateClusterer.prototype.getStateControl = function() {
        return this.stateControl_;
        };
        /**
         *  Gets the cluster metric name.
         *
         *  @return {string} The name of the cluster metric.
         */
        StateClusterer.prototype.getClusterMetric = function() {
        return this.clusterMetric_;
        };
        /**
         * Whether zoom on click is set.
         *
         * @return {boolean} True if zoomOnClick_ is set.
         */
        StateClusterer.prototype.isZoomOnClick = function() {
        return this.zoomOnClick_;
        };
        /**
         * Whether average center is set.
         *
         * @return {boolean} True if averageCenter_ is set.
         */
        StateClusterer.prototype.isAverageCenter = function() {
        return this.averageCenter_;
        };
        /**
         *  Returns the array of markers in the clusterer.
         *
         *  @return {Array.<google.maps.Marker>} The markers.
         */
        StateClusterer.prototype.getMarkers = function() {
        return this.markers_;
        };
        /**
         *  Sets the max zoom for the clusterer.
         *
         *  @param {number} maxZoom The max zoom level.
         */
        StateClusterer.prototype.setMaxZoom = function(maxZoom) {
        this.maxZoom_ = maxZoom;
        };
        /**
         *  Gets the max zoom for the clusterer.
         *
         *  @return {number} The max zoom level.
         */
        StateClusterer.prototype.getMaxZoom = function() {
        return this.maxZoom_;
        };
        /**
         *  The function for calculating the cluster icon image.
         *
         *  @param {Array.<google.maps.Marker>} markers The markers in the clusterer.
         *  @param {Object} A object that has weights associated with each marker type.
         *  @return {Object} A object properties: 'text' (string) and 'index' (number).
         *  @private
         */
        StateClusterer.prototype.calculator_ = function(markers, markerWeights) {
        var typeSum = 0;
                var metricSum = 0;
                var count = 0;
                if (markerWeights != undefined) {
        markers.forEach(function(m) {
        count += parseFloat(markerWeights[m.type]);
                typeSum += parseFloat(markerWeights[m.type]) * m.type;
                metricSum += m.metric;
        });
        }
        else {
        count = markers.length;
                markers.forEach(function(m) {
                typeSum += m.type;
                        metricSum += m.metric;
                });
        }

        var text = intToString(metricSum);
                // average of markers in a cluster
                var index = Math.round(parseFloat(typeSum) / count);
                return {
                text: text,
                        index: index
                };
        };
        function intToString (value) {
        var suffixes = ["", "k", "m", "b", "t"];
                var suffixNum = Math.floor((("" + value).length - 1) / 3);
                if (suffixNum > 4) suffixNum = 4;
                var shortValue = parseFloat((suffixNum != 0 ? (value / Math.pow(1000, suffixNum)) : value).toFixed(2));
                return shortValue + suffixes[suffixNum];
        }


/**
 * Set the calculator function.
 *
 * @param {function(Array, number)} calculator The function to set as the
 *     calculator. The function should return a object properties:
 *     'text' (string) and 'index' (number).
 *
 */
StateClusterer.prototype.setCalculator = function(calculator) {
this.calculator_ = calculator;
};
        /**
         * Get the calculator function.
         *
         * @return {function(Array, number)} the calculator function.
         */
        StateClusterer.prototype.getCalculator = function() {
        return this.calculator_;
        };
        /**
         * Add an array of markers to the clusterer.
         *
         * @param {Array.<google.maps.Marker>} markers The markers to add.
         * @param {boolean=} opt_nodraw Whether to redraw the clusters.
         */
        StateClusterer.prototype.addMarkers = function(markers, opt_nodraw) {
        for (var i = 0, marker; marker = markers[i]; i++) {
        this.pushMarkerTo_(marker);
        }
        if (!opt_nodraw) {
        this.redraw();
        }
        };
        /**
         * Pushes a marker to the clusterer.
         *
         * @param {google.maps.Marker} marker The marker to add.
         * @private
         */
        StateClusterer.prototype.pushMarkerTo_ = function(marker) {
        marker.isAdded = false;
                if (marker['draggable']) {
        // If the marker is draggable add a listener so we update the clusters on
        // the drag end.
        var that = this;
                google.maps.event.addListener(marker, 'dragend', function() {
                marker.isAdded = false;
                        that.repaint();
                });
        }
        this.markers_.push(marker);
        };
        /**
         * Adds a marker to the clusterer and redraws if needed.
         *
         * @param {google.maps.Marker} marker The marker to add.
         * @param {boolean=} opt_nodraw Whether to redraw the clusters.
         */
        StateClusterer.prototype.addMarker = function(marker, opt_nodraw) {
        this.pushMarkerTo_(marker);
                if (!opt_nodraw) {
        this.redraw();
        }
        };
        /**
         * Removes a marker and returns true if removed, false if not
         *
         * @param {google.maps.Marker} marker The marker to remove
         * @return {boolean} Whether the marker was removed or not
         * @private
         */
        StateClusterer.prototype.removeMarker_ = function(marker) {
        var index = - 1;
                if (this.markers_.indexOf) {
        index = this.markers_.indexOf(marker);
        } else {
        for (var i = 0, m; m = this.markers_[i]; i++) {
        if (m == marker) {
        index = i;
                break;
        }
        }
        }

        if (index == - 1) {
        // Marker is not in our list of markers.
        return false;
        }

        marker.setMap(null);
                this.markers_.splice(index, 1);
                return true;
        };
        /**
         * Remove a marker from the cluster.
         *
         * @param {google.maps.Marker} marker The marker to remove.
         * @param {boolean=} opt_nodraw Optional boolean to force no redraw.
         * @return {boolean} True if the marker was removed.
         */
        StateClusterer.prototype.removeMarker = function(marker, opt_nodraw) {
        var removed = this.removeMarker_(marker);
                if (!opt_nodraw && removed) {
        this.resetViewport();
                this.redraw();
                return true;
        } else {
        return false;
        }
        };
        /**
         * Removes an array of markers from the cluster.
         *
         * @param {Array.<google.maps.Marker>} markers The markers to remove.
         * @param {boolean=} opt_nodraw Optional boolean to force no redraw.
         */
        StateClusterer.prototype.removeMarkers = function(markers, opt_nodraw) {
        var removed = false;
                for (var i = 0, marker; marker = markers[i]; i++) {
        var r = this.removeMarker_(marker);
                removed = removed || r;
        }
        google.maps.event.trigger(this, "removeCluster", this);
                if (!opt_nodraw && removed) {
        this.resetViewport();
                this.redraw();
                return true;
        }
        };
        /**
         * Sets the clusterer's ready state.
         *
         * @param {boolean} ready The state.
         * @private
         */
        StateClusterer.prototype.setReady_ = function(ready) {
        if (!this.ready_) {
        this.ready_ = ready;
                this.createClusters_();
        }
        };
        /**
         * Returns the number of clusters in the clusterer.
         *
         * @return {number} The number of clusters.
         */
        StateClusterer.prototype.getTotalClusters = function() {
        return this.clusters_.length;
        };
        /**
         * Returns the google map that the clusterer is associated with.
         *
         * @return {google.maps.Map} The map.
         */
        StateClusterer.prototype.getMap = function() {
        return this.map_;
        };
        /**
         * Sets the google map that the clusterer is associated with.
         *
         * @param {google.maps.Map} map The map.
         */
        StateClusterer.prototype.setMap = function(map) {
        this.map_ = map;
        };
        /**
         * Extends a bounds object.
         *
         * @param {google.maps.LatLngBounds} bounds The bounds to extend.
         * @return {google.maps.LatLngBounds} The extended bounds.
         */
        StateClusterer.prototype.getExtendedBounds = function(bounds) {
        // Turn the bounds into latlng.
        var ne = new google.maps.LatLng(bounds.getNorthEast().lat(),
                bounds.getNorthEast().lng());
                var sw = new google.maps.LatLng(bounds.getSouthWest().lat(),
                        bounds.getSouthWest().lng());
                // Extend the bounds to contain the new bounds.
                bounds.extend(ne);
                bounds.extend(sw);
                return bounds;
        };
        /**
         * Determines if a marker is contained in a bounds.
         *
         * @param {google.maps.Marker} marker The marker to check.
         * @param {google.maps.LatLngBounds} bounds The bounds to check against.
         * @return {boolean} True if the marker is in the bounds.
         * @private
         */
        StateClusterer.prototype.isMarkerInBounds_ = function(marker, bounds) {
        return bounds.contains(marker.getPosition());
        };
        /**
         * Clears all clusters and markers from the clusterer.
         */
        StateClusterer.prototype.clearMarkers = function() {
        this.resetViewport(true);
                // Set the markers a empty array.
                this.markers_ = [];
        };
        /**
         * Clears all existing clusters and recreates them.
         * @param {boolean} opt_hide To also hide the marker.
         */
        StateClusterer.prototype.resetViewport = function(opt_hide) {
        // Remove all the clusters
        for (var i = 0, cluster; cluster = this.clusters_[i]; i++) {
        cluster.remove();
        }

        // Reset the markers to not be added and to be invisible.
        for (var i = 0, marker; marker = this.markers_[i]; i++) {
        marker.isAdded = false;
                if (opt_hide) {
        marker.setMap(null);
        }
        }

        this.clusters_ = [];
        };
        /**
         *
         */
        StateClusterer.prototype.repaint = function() {
        var oldClusters = this.clusters_.slice();
                this.clusters_.length = 0;
                this.resetViewport();
                this.redraw();
                // Remove the old clusters.
                // Do it in a timeout so the other clusters have been drawn first.
                window.setTimeout(function() {
                for (var i = 0, cluster; cluster = oldClusters[i]; i++) {
                cluster.remove();
                }
                }, 0);
        };
        /**
         * Redraws the clusters.
         */
        StateClusterer.prototype.redraw = function() {
        if (this.getCurrentStateIndex() < this.getDomainStates().length)
                this.createClusters_();
                else {
                var mapBounds = new google.maps.LatLngBounds(this.map_.getBounds().getSouthWest(),
                        this.map_.getBounds().getNorthEast());
                        var bounds = this.getExtendedBounds(mapBounds);
                        for (var i = 0, marker; marker = this.markers_[i]; i++) {
                if (this.isMarkerInBounds_(marker, bounds)) {
                marker.setMap(this.map_);
                }
                }
                }
        };
        /**
         * Add a marker to a cluster, or creates a new cluster.
         *
         * @param {google.maps.Marker} marker The marker to add.
         * @private
         */
        StateClusterer.prototype.addToClosestCluster_ = function(marker) {
        var clusterToAddTo = null;
                var currentStateIndex = this.getCurrentStateIndex();
                var mState = this.getDomainStates()[currentStateIndex] + ' : ' + marker.get('state').split("|")[currentStateIndex];
                for (var i = 0, cluster; cluster = this.clusters_[i]; i++) {
        var cState = cluster.getState();
                if (cState) {
        if (mState == cState) {
        clusterToAddTo = cluster;
        }
        }
        }

        if (clusterToAddTo) {
        clusterToAddTo.addMarker(marker);
        } else {
        var cluster = new DomainCluster(this);
                cluster.setState(mState);
                cluster.addMarker(marker);
                this.clusters_.push(cluster);
        }
        };
        /**
         * Creates the clusters.
         *
         * @private
         */
        StateClusterer.prototype.createClusters_ = function() {
        if (!this.ready_) {
        return;
        }

        // Get our current map view bounds.
        // Create a new bounds object so we don't affect the map.
        var mapBounds = new google.maps.LatLngBounds(this.map_.getBounds().getSouthWest(),
                this.map_.getBounds().getNorthEast());
                var bounds = this.getExtendedBounds(mapBounds);
                for (var i = 0, marker; marker = this.markers_[i]; i++) {
        if (!marker.isAdded && this.isMarkerInBounds_(marker, bounds)) {
        this.addToClosestCluster_(marker);
        }
        }
        for (var i = 0, cluster; cluster = this.clusters_[i]; i++) {
        cluster.updateIcon();
        }
        google.maps.event.trigger(this, "clusteringend", this);
        };
        /**
         * A cluster that contains markers.
         *
         * @param {StateClusterer} stateClusterer The stateclusterer that this
         *     cluster is associated with.
         * @constructor
         * @ignore
         */
                function DomainCluster(stateClusterer) {
                this.stateClusterer_ = stateClusterer;
                        this.map_ = stateClusterer.getMap();
                        this.averageCenter_ = stateClusterer.isAverageCenter();
                        this.center_ = null;
                        this.markers_ = [];
                        this.bounds_ = null;
                        this.state_ = null;
                        this.clusterIcon_ = new DomainClusterIcon(this, stateClusterer.getStyles());
                }

        /**
         * Determins if a marker is already added to the cluster.
         *
         * @param {google.maps.Marker} marker The marker to check.
         * @return {boolean} True if the marker is already added.
         */
        DomainCluster.prototype.isMarkerAlreadyAdded = function(marker) {
        if (this.markers_.indexOf) {
        return this.markers_.indexOf(marker) != - 1;
        } else {
        for (var i = 0, m; m = this.markers_[i]; i++) {
        if (m == marker) {
        return true;
        }
        }
        }
        return false;
        };
                /**
                 * Add a marker the cluster.
                 *
                 * @param {google.maps.Marker} marker The marker to add.
                 * @return {boolean} True if the marker was added.
                 */
                DomainCluster.prototype.addMarker = function(marker) {
                if (this.isMarkerAlreadyAdded(marker)) {
                return false;
                }

                if (!this.center_) {
                this.center_ = marker.getPosition();
                        this.calculateBounds_();
                } else {
                if (this.averageCenter_) {
                var l = this.markers_.length + 1;
                        var lat = (this.center_.lat() * (l - 1) + marker.getPosition().lat()) / l;
                        var lng = (this.center_.lng() * (l - 1) + marker.getPosition().lng()) / l;
                        this.center_ = new google.maps.LatLng(lat, lng);
                        this.calculateBounds_();
                }
                }

                marker.isAdded = true;
                        this.markers_.push(marker);
                        var len = this.markers_.length;
                        if (len < 2 && marker.getMap() != this.map_) {
                marker.setMap(this.map_);
                }

                if (len == 2) {
                // Hide the markers that were showing.
                for (var i = 0; i < len; i++) {
                this.markers_[i].setMap(null);
                }
                }

                if (len >= 2) {
                marker.setMap(null);
                }

                this.updateIcon();
                        return true;
                };
                /**
                 * Returns the marker clusterer that the cluster is associated with.
                 *
                 * @return {StateClusterer} The associated marker clusterer.
                 */
                DomainCluster.prototype.getStateClusterer = function() {
                return this.stateClusterer_;
                };
                /**
                 * Returns the marker clusterer that the cluster is associated with.
                 *
                 * @return {StateClusterer} The associated marker clusterer.
                 */
                DomainCluster.prototype.getState = function() {
                return this.state_;
                };
                /**
                 * Returns the marker clusterer that the cluster is associated with.
                 *
                 * @return {StateClusterer} The associated marker clusterer.
                 */
                DomainCluster.prototype.setState = function(state) {
                this.state_ = state;
                };
                /**
                 * Returns the bounds of the cluster.
                 *
                 * @return {google.maps.LatLngBounds} the cluster bounds.
                 */
                DomainCluster.prototype.getBounds = function() {
                var bounds = new google.maps.LatLngBounds(this.center_, this.center_);
                        var markers = this.getMarkers();
                        for (var i = 0, marker; marker = markers[i]; i++) {
                bounds.extend(marker.getPosition());
                }
                return bounds;
                };
                /**
                 * Removes the cluster
                 */
                DomainCluster.prototype.remove = function() {
                this.clusterIcon_.remove();
                        this.markers_.length = 0;
                        delete this.markers_;
                };
                /**
                 * Returns the center of the cluster.
                 *
                 * @return {number} The cluster center.
                 */
                DomainCluster.prototype.getSize = function() {
                return this.markers_.length;
                };
                /**
                 * Returns the center of the cluster.
                 *
                 * @return {Array.<google.maps.Marker>} The cluster center.
                 */
                DomainCluster.prototype.getMarkers = function() {
                return this.markers_;
                };
                /**
                 * Returns the center of the cluster.
                 *
                 * @return {google.maps.LatLng} The cluster center.
                 */
                DomainCluster.prototype.getCenter = function() {
                return this.center_;
                };
                /**
                 * Calculated the extended bounds of the cluster with the grid.
                 *
                 * @private
                 */
                DomainCluster.prototype.calculateBounds_ = function() {
                var bounds = new google.maps.LatLngBounds(this.center_, this.center_);
                        this.bounds_ = this.stateClusterer_.getExtendedBounds(bounds);
                };
                /**
                 * Determines if a marker lies in the clusters bounds.
                 *
                 * @param {google.maps.Marker} marker The marker to check.
                 * @return {boolean} True if the marker lies in the bounds.
                 */
                DomainCluster.prototype.isMarkerInClusterBounds = function(marker) {
                return this.bounds_.contains(marker.getPosition());
                };
                /**
                 * Returns the map that the cluster is associated with.
                 *
                 * @return {google.maps.Map} The map.
                 */
                DomainCluster.prototype.getMap = function() {
                return this.map_;
                };
                /**
                 * Updates the cluster icon
                 */
                DomainCluster.prototype.updateIcon = function() {
                var zoom = this.map_.getZoom();
                        var mz = this.stateClusterer_.getMaxZoom();
                        if (mz && zoom > mz){
                // The zoom is greater than our max zoom so show all the markers in cluster.
                for (var i = 0, marker; marker = this.markers_[i]; i++) {
                marker.setMap(this.map_);
                }
                return;
                }

                if (this.markers_.length < 2) {
                // Min cluster size reached.
                this.clusterIcon_.hide();
                        return;
                }

                var sums = this.stateClusterer_.getCalculator()(this.markers_, this.stateClusterer_.getMarkerWeights());
                        this.clusterIcon_.setCenter(this.center_);
                        this.clusterIcon_.setSums(sums);
                        this.clusterIcon_.show();
                };
                /**
                 * A cluster icon
                 *
                 * @param {DomainCluster} cluster The cluster to be associated with.
                 * @param {Object} styles An object that has style properties:
                 *     'url': (string) The image url.
                 *     'height': (number) The image height.
                 *     'width': (number) The image width.
                 *     'anchor': (Array) The anchor position of the label text.
                 *     'textColor': (string) The text color.
                 *     'textSize': (number) The text size.
                 *     'backgroundPosition: (string) The background postition x, y.
                 * @param {number=} opt_padding Optional padding to apply to the cluster icon.
                 * @constructor
                 * @extends google.maps.OverlayView
                 * @ignore
                 */
                        function DomainClusterIcon(cluster, styles, opt_padding) {
                        cluster.getStateClusterer().extend(DomainClusterIcon, google.maps.OverlayView);
                                this.styles_ = styles;
                                this.cluster_ = cluster;
                                this.center_ = null;
                                this.map_ = cluster.getMap();
                                this.div_ = null;
                                this.sums_ = null;
                                this.visible_ = false;
                                this.setMap(this.map_);
                        }


                /**
                 * Triggers the clusterclick event and zoom's if the option is set.
                 *
                 * @param {google.maps.MouseEvent} event The event to propagate
                 */
                DomainClusterIcon.prototype.triggerClusterClick = function(event) {
                var stateClusterer = this.cluster_.getStateClusterer();
                        // increment the current state index
                        stateClusterer.setCurrentStateIndex(stateClusterer.getCurrentStateIndex() + 1);
                        // Trigger the clusterclick event.
                        google.maps.event.trigger(stateClusterer, 'clusterclick', this.cluster_, event);
                        if (stateClusterer.isZoomOnClick()) {
                var stateControl = stateClusterer.getStateControl();
                        stateControl.addCurrentState(this.map_.getCenter(), this.map_.getZoom(), stateClusterer);
                        // Zoom into the cluster.
                        this.map_.fitBounds(this.cluster_.getBounds());
                }
                };
                        /**
                         * Triggers the clustermouseover event and zoom's if the option is set.
                         *
                         * @param {google.maps.MouseEvent} event The event to propagate
                         */
                        DomainClusterIcon.prototype.triggerClusterMouseOver = function(event) {
                        var stateClusterer = this.cluster_.getStateClusterer();
                                var currentStateIndex = stateClusterer.getCurrentStateIndex();
                                // Trigger the clustermousover event.
                                google.maps.event.trigger(stateClusterer, 'clustermouseover', this.cluster_, event);
                                if (this.visible_) {
                        //var pos = this.getPosFromLatLng_(this.center_);
                        if (this.div_.childNodes.length != 2) {
                        var div = document.createElement('DIV');
                                div.style.cssText = 'position:relative;background:white;color:black;padding:5px;font-size:12px;display:inline-block;white-space:nowrap;text-align:left;line-height:12px';
                                div.innerHTML = '<div id="content" style="font-family:Arial,sans-serif">'
                                + '<h4 id="firstHeading" class="firstHeading"> ' + this.cluster_.getState() + '</h4>'
                                + '<div id="bodyContent">'
                                + '<b style="margin-right:0.5em">' + stateClusterer.getClusterMetric() + '</b>'
                                + '<b>:</b><b style="margin-left:0.5em">' + this.text_ + '</b></div></div>';
                                this.div_.appendChild(div);
                        }
                        else {
                        this.div_.childNodes[1].style.cssText = 'position:relative;background:white;color:black;padding:5px;font-size:12px;display:inline-block;white-space:nowrap;text-align:left;line-height:12px';
                        }
                        }
                        };
                        /**
                         * Triggers the clustermouseout event and zoom's if the option is set.
                         *
                         * @param {google.maps.MouseEvent} event The event to propagate
                         */
                        DomainClusterIcon.prototype.triggerClusterMouseOut = function(event) {
                        var stateClusterer = this.cluster_.getStateClusterer();
                                // Trigger the clustermouseout event.
                                google.maps.event.trigger(stateClusterer, 'clustermouseout', this.cluster_, event);
                                if (this.visible_) {
                        this.div_.childNodes[1].style.cssText = 'display:none;';
                        }
                        };
                        /**
                         * Adding the cluster icon to the dom.
                         * @ignore
                         */
                        DomainClusterIcon.prototype.onAdd = function() {
                        this.div_ = document.createElement('DIV');
                                if (this.visible_) {
                        var pos = this.getPosFromLatLng_(this.center_);
                                this.div_.style.cssText = this.createCss(pos);
                                this.div_.innerHTML = this.sums_.text;
                        }

                        var panes = this.getPanes();
                                panes.overlayMouseTarget.appendChild(this.div_);
                                var that = this;
                                google.maps.event.addDomListener(this.div_, 'click', function(event) {
                                that.triggerClusterClick(event);
                                });
                                google.maps.event.addDomListener(this.div_, 'mouseover', function(event) {
                                that.triggerClusterMouseOver(event);
                                });
                                google.maps.event.addDomListener(this.div_, 'mouseout', function(event) {
                                that.triggerClusterMouseOut(event);
                                });
                        };
                        /**
                         * Returns the position to place the div dending on the latlng.
                         *
                         * @param {google.maps.LatLng} latlng The position in latlng.
                         * @return {google.maps.Point} The position in pixels.
                         * @private
                         */
                        DomainClusterIcon.prototype.getPosFromLatLng_ = function(latlng) {
                        var pos = this.getProjection().fromLatLngToDivPixel(latlng);
                                if (typeof this.iconAnchor_ === 'object' && this.iconAnchor_.length === 2) {
                        pos.x -= this.iconAnchor_[0];
                                pos.y -= this.iconAnchor_[1];
                        } else {
                        pos.x -= parseInt(this.width_ / 2, 10);
                                pos.y -= parseInt(this.height_ / 2, 10);
                        }
                        return pos;
                        };
                        /**
                         * Draw the icon.
                         * @ignore
                         */
                        DomainClusterIcon.prototype.draw = function() {
                        if (this.visible_) {
                        var pos = this.getPosFromLatLng_(this.center_);
                                this.div_.style.top = pos.y + 'px';
                                this.div_.style.left = pos.x + 'px';
                        }
                        };
                        /**
                         * Hide the icon.
                         */
                        DomainClusterIcon.prototype.hide = function() {
                        if (this.div_) {
                        this.div_.style.display = 'none';
                        }
                        this.visible_ = false;
                        };
                        /**
                         * Position and show the icon.
                         */
                        DomainClusterIcon.prototype.show = function() {
                        if (this.div_) {
                        var pos = this.getPosFromLatLng_(this.center_);
                                this.div_.style.cssText = this.createCss(pos);
                                this.div_.style.display = '';
                        }
                        this.visible_ = true;
                        };
                        /**
                         * Remove the icon from the map
                         */
                        DomainClusterIcon.prototype.remove = function() {
                        this.setMap(null);
                        };
                        /**
                         * Implementation of the onRemove interface.
                         * @ignore
                         */
                        DomainClusterIcon.prototype.onRemove = function() {
                        if (this.div_ && this.div_.parentNode) {
                        this.hide();
                                this.div_.parentNode.removeChild(this.div_);
                                this.div_ = null;
                        }
                        };
                        /**
                         * Set the sums of the icon.
                         *
                         * @param {Object} sums The sums containing:
                         *   'text': (string) The text to display in the icon.
                         *   'index': (number) The style index of the icon.
                         */
                        DomainClusterIcon.prototype.setSums = function(sums) {
                        this.sums_ = sums;
                                this.text_ = sums.text;
                                this.index_ = sums.index;
                                if (this.div_) {
                        this.div_.innerHTML = sums.text;
                        }

                        this.useStyle();
                        };
                        /**
                         * Sets the icon to the the styles.
                         */
                        DomainClusterIcon.prototype.useStyle = function() {
                        var index = Math.max(0, this.sums_.index - 1);
                                index = Math.min(this.styles_.length - 1, index);
                                var style = this.styles_[index];
                                this.url_ = style['url'];
                                this.height_ = style['height'];
                                this.width_ = style['width'];
                                this.textColor_ = style['textColor'];
                                this.anchor_ = style['anchor'];
                                this.textSize_ = style['textSize'];
                                this.backgroundPosition_ = style['backgroundPosition'];
                                this.iconAnchor_ = style['iconAnchor'];
                        };
                        /**
                         * Sets the center of the icon.
                         *
                         * @param {google.maps.LatLng} center The latlng to set as the center.
                         */
                        DomainClusterIcon.prototype.setCenter = function(center) {
                        this.center_ = center;
                        };
                        /**
                         * Create the css text based on the position of the icon.
                         *
                         * @param {google.maps.Point} pos The position.
                         * @return {string} The css style text.
                         */
                        DomainClusterIcon.prototype.createCss = function(pos) {
                        var style = [];
                                style.push('background-image:url(' + this.url_ + ');');
                                var backgroundPosition = this.backgroundPosition_ ? this.backgroundPosition_ : '0 0';
                                style.push('background-position:' + backgroundPosition + ';');
                                if (typeof this.anchor_ === 'object') {
                        if (typeof this.anchor_[0] === 'number' && this.anchor_[0] > 0 &&
                                this.anchor_[0] < this.height_) {
                        style.push('height:' + (this.height_ - this.anchor_[0]) +
                                'px; padding-top:' + this.anchor_[0] + 'px;');
                        } else if (typeof this.anchor_[0] === 'number' && this.anchor_[0] < 0 &&
                                - this.anchor_[0] < this.height_) {
                        style.push('height:' + this.height_ + 'px; line-height:' + (this.height_ + this.anchor_[0]) +
                                'px;');
                        } else {
                        style.push('height:' + this.height_ + 'px; line-height:' + this.height_ +
                                'px;');
                        }
                        if (typeof this.anchor_[1] === 'number' && this.anchor_[1] > 0 &&
                                this.anchor_[1] < this.width_) {
                        style.push('width:' + (this.width_ - this.anchor_[1]) +
                                'px; padding-left:' + this.anchor_[1] + 'px;');
                        } else {
                        style.push('width:' + this.width_ + 'px; text-align:center;');
                        }
                        } else {
                        style.push('height:' + this.height_ + 'px; line-height:' +
                                this.height_ + 'px; width:' + this.width_ + 'px; text-align:center;');
                        }

                        var txtColor = this.textColor_ ? this.textColor_ : 'white';
                                var txtSize = this.textSize_ ? this.textSize_ : 11;
                                style.push('cursor:pointer; top:' + pos.y + 'px; left:' +
                                        pos.x + 'px; color:' + txtColor + '; position:absolute; font-size:' +
                                        txtSize + 'px; font-family:Arial,sans-serif; font-weight:bold');
                                return style.join('');
                        };
                        /**
                         * The DomainStateControl adds a control to the map that recenters the map
                         * to its previos state.
                         * @constructor
                         * @param {!Element} stateControlDiv
                         * @param {!google.maps.Map} map
                         */

                        var slider = false;
                        function filterMarkerSlider() {
                        if (!slider) {
                        $("#s").attr("class", "ion-close-round");
                                $(".marker").width("auto");
                                $("#highlightMarkerState").height("30%");
                        }
                        else {
                        $("#s").attr("class", "ion-information-circled");
                                $(".marker").width("0px");
                                $("#highlightMarkerState").height("0%");
                        }
                        slider = !slider;
                        }

                function DomainStateControl(stateControlDiv, map, image_path, markerColumn, colorPallet) {
                // We set up a variable for this since we're adding event listeners later
                var control = this;
//Set marker Labels
                        var highlightMarkerStateUI = document.createElement('div');
                        highlightMarkerStateUI.id = 'highlightMarkerState';
                        highlightMarkerStateUI.style.cursor = 'pointer';
                        highlightMarkerStateUI.title = 'Marker Legend';
                        stateControlDiv.appendChild(highlightMarkerStateUI)

//set Marker DescriptionIcon @Saurabh
                        var highlightMarkerStateIcon = document.createElement('div');
                        highlightMarkerStateIcon.style.marginBottom = '20px';
                        highlightMarkerStateIcon.style.marginRight = '10px';
                        highlightMarkerStateIcon.setAttribute('id', 's');
                        highlightMarkerStateIcon.setAttribute('class', 'ion-information-circled');
                        highlightMarkerStateUI.appendChild(highlightMarkerStateIcon)

                        if (colorPallet.substring(colorPallet.length - 1) == "3") {
                html = '<div style="font-family:Arial,sans-serif";><p><img src="' +
                        image_path + "3-dot.png" + '""> High ' + markerColumn + '</p><p><img src="' +
                        image_path + "2-dot.png" + '"">  Medium ' + markerColumn + '</p><p><img src="' +
                        image_path + "1-dot.png" + '"">  Low ' + markerColumn + '</p>';
                }
                else {
                html = '<div style="font-family:Arial,sans-serif;">' +
                        '<p>' +
                        '<img src="' + image_path + '5-dot.png"> Very High ' + markerColumn + '</p>' +
                        '<p>' +
                        '<img src="' + image_path + '4-dot.png"> High ' + markerColumn + '</p>' +
                        '<p>' +
                        '<img src="' + image_path + '3-dot.png"> Medium ' + markerColumn + '</p>' +
                        '<p>' +
                        '<img src="' + image_path + '2-dot.png">  Low ' + markerColumn + '</p>' +
                        '<p>' +
                        '<img src="' + image_path + '1-dot.png">  Very Low ' + markerColumn + '</p>';
                }
                document.getElementById("filterMarker").innerHTML = html;
                        /*var highlightMarkerStateUI = document.createElement('div');
                         highlightMarkerStateUI.id='highlightMarkerState';
                         highlightMarkerStateUI.style.backgroundColor = '#ffffff';
                         highlightMarkerStateUI.style.border = '2px solid #ffffff';
                         highlightMarkerStateUI.style.borderRadius = '3px';
                         highlightMarkerStateUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
                         highlightMarkerStateUI.style.cursor = 'pointer';
                         highlightMarkerStateUI.style.marginBottom = '5px';
                         highlightMarkerStateUI.style.marginRight = '10px';
                         highlightMarkerStateUI.style.width = '40px';
                         highlightMarkerStateUI.style.height = '25px';
                         highlightMarkerStateUI.style.textAlign = 'center';
                         highlightMarkerStateUI.title = 'See marker State';
                         stateControlDiv.appendChild(highlightMarkerStateUI)
                         
                         var highlightMarkerStateIcon = document.createElement('div');
                         highlightMarkerStateIcon.style.marginBottom = '20px';
                         highlightMarkerStateIcon.style.marginRight = '10px';
                         highlightMarkerStateIcon.setAttribute('id', 'highlightMarkerStateUI');
                         highlightMarkerStateIcon.setAttribute('class', 'glyphicon glyphicon-flag icons');
                         highlightMarkerStateIcon.style.color = '#d3d3d3';
                         highlightMarkerStateUI.appendChild(highlightMarkerStateIcon);*/


                        // Set CSS for the control border
                        var goPreviousStateUI = document.createElement('div');
                        goPreviousStateUI.id = 'goPreviousStateUI';
                        goPreviousStateUI.title = 'Click to go to the previous state of the map';
                        stateControlDiv.appendChild(goPreviousStateUI);
                        // Set CSS for the control interior
                        var goPreviousStateIcon = document.createElement('div');
                        goPreviousStateIcon.style.marginBottom = '10px';
                        goPreviousStateIcon.style.marginRight = '10px';
                        goPreviousStateIcon.setAttribute('id', 'goPreviousStateIcon');
                        goPreviousStateIcon.setAttribute('class', 'zoomOutDisable');
                        goPreviousStateIcon.style.color = '#d3d3d3';
                        goPreviousStateUI.appendChild(goPreviousStateIcon);
                        this.stateStack_ = [];
                        // Set up the click event listener for 'Previous State': Set the center and zoom of the map
                        // to the center and zoom of the previous state.
                        goPreviousStateIcon.addEventListener('click', function() {
                        var previousState = control.getPreviousState();
                                if (previousState != undefined) {
                        previousState.stateClusterer.setCurrentStateIndex(previousState.stateClusterer.getCurrentStateIndex() - 1);
                                map.setCenter(previousState.center);
                                map.setZoom(previousState.zoom);
                        }

                        if (control.getNumberOfStates() == 0) {
                        var goPreviousStateUI = document.getElementById('goPreviousStateIcon');
                                goPreviousStateIcon.setAttribute('class', 'zoomOutDisable');
                        }
                        });
                }

                /**
                 * Define a property to hold the previous states of the map.
                 * @private
                 */
                DomainStateControl.prototype.stateStack_ = [];
                        /**
                         * Gets the maps previous state.
                         * @return {?google.maps.LatLng, number}
                         */
                        DomainStateControl.prototype.getPreviousState = function() {
                        return this.stateStack_.pop();
                        };
                        /**
                         * Gets the number of states available in the stack.
                         * @return {number}
                         */
                        DomainStateControl.prototype.getNumberOfStates = function() {
                        return this.stateStack_.length;
                        };
                        /**
                         * Adds the maps current state into the stack.
                         * @param {?google.maps.LatLng} center
                         * @param {number} zoom
                         * @param {object} cluster
                         * @param {object} prevCluster
                         */
                        DomainStateControl.prototype.addCurrentState = function(center, zoom, stateClusterer) {
                        this.stateStack_.push({"center": center, "zoom": zoom, "stateClusterer": stateClusterer});
                                var goPreviousStateIcon = document.getElementById('goPreviousStateIcon');
                                goPreviousStateIcon.setAttribute('class', 'zoomOut');
                        };
// Export Symbols for Closure
// If you are not going to compile with closure then you can remove the
// code below.
                        window['StateClusterer'] = StateClusterer;
                        StateClusterer.prototype['addMarker'] = StateClusterer.prototype.addMarker;
                        StateClusterer.prototype['addMarkers'] = StateClusterer.prototype.addMarkers;
                        StateClusterer.prototype['clearMarkers'] =
                        StateClusterer.prototype.clearMarkers;
                        StateClusterer.prototype['fitMapToMarkers'] =
                        StateClusterer.prototype.fitMapToMarkers;
                        StateClusterer.prototype['getCalculator'] =
                        StateClusterer.prototype.getCalculator;
                        StateClusterer.prototype['getGridSize'] =
                        StateClusterer.prototype.getGridSize;
                        StateClusterer.prototype['getExtendedBounds'] =
                        StateClusterer.prototype.getExtendedBounds;
                        StateClusterer.prototype['getMap'] = StateClusterer.prototype.getMap;
                        StateClusterer.prototype['getMarkers'] = StateClusterer.prototype.getMarkers;
                        StateClusterer.prototype['getMaxZoom'] = StateClusterer.prototype.getMaxZoom;
                        StateClusterer.prototype['getStyles'] = StateClusterer.prototype.getStyles;
                        StateClusterer.prototype['getTotalClusters'] =
                        StateClusterer.prototype.getTotalClusters;
                        StateClusterer.prototype['redraw'] = StateClusterer.prototype.redraw;
                        StateClusterer.prototype['removeMarker'] =
                        StateClusterer.prototype.removeMarker;
                        StateClusterer.prototype['removeMarkers'] =
                        StateClusterer.prototype.removeMarkers;
                        StateClusterer.prototype['resetViewport'] =
                        StateClusterer.prototype.resetViewport;
                        StateClusterer.prototype['repaint'] =
                        StateClusterer.prototype.repaint;
                        StateClusterer.prototype['setCalculator'] =
                        StateClusterer.prototype.setCalculator;
                        StateClusterer.prototype['setGridSize'] =
                        StateClusterer.prototype.setGridSize;
                        StateClusterer.prototype['setMaxZoom'] =
                        StateClusterer.prototype.setMaxZoom;
                        StateClusterer.prototype['setMap'] =
                        StateClusterer.prototype.setMap;
                        StateClusterer.prototype['onAdd'] = StateClusterer.prototype.onAdd;
                        StateClusterer.prototype['draw'] = StateClusterer.prototype.draw;
                        DomainCluster.prototype['getCenter'] = DomainCluster.prototype.getCenter;
                        DomainCluster.prototype['getSize'] = DomainCluster.prototype.getSize;
                        DomainCluster.prototype['getMarkers'] = DomainCluster.prototype.getMarkers;
                        DomainClusterIcon.prototype['onAdd'] = DomainClusterIcon.prototype.onAdd;
                        DomainClusterIcon.prototype['draw'] = DomainClusterIcon.prototype.draw;
                        DomainClusterIcon.prototype['onRemove'] = DomainClusterIcon.prototype.onRemove;

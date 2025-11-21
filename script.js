// Config
const topoJsonUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"; // topojson file (countries)
const circuits = "./data/circuits.csv"
const container = d3.select("#map");
const tooltip = container.append("div").attr("class","tooltip");

// Create responsive SVG
const svg = container.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block");

// We'll create a group for map content and apply zoom transforms to it
const g = svg.append("g").attr("class","map-layer");

// Graticule (optional)
const graticule = d3.geoGraticule();

// Projection: Mercator. We'll set scale/translate in resize()
const projection = d3.geoMercator();
const geopath_generator = d3.geoPath().projection(projection);

// Draw graticule first (so it's below countries)
const gratPath = g.append("path")
    .datum(graticule)
    .attr("class","graticule")
    .attr("fill","none")
    .attr("stroke","#e8eef8");

// Load TopoJSON and render map
Promise.all([
	d3.json(topoJsonUrl),
	d3.csv(circuits)
]).then(data => {
	const [topology, circuits] = data
    // topojson.feature converts to GeoJSON FeatureCollection
    const countries = topojson.feature(topology, topology.objects.countries);

    // create country shapes
    g.selectAll("path.country")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", d => geopath_generator(d))
        .on("mouseenter", function(event, d) {
            tooltip.style("opacity", 1).text(d.properties.name || "Unknown");
        })
        .on("mousemove", function(event) {
            const [mx,my] = d3.pointer(event, container.node());
            tooltip.style("left", mx + "px").style("top", my + "px");
        })
        .on("mouseleave", function() {
            tooltip.style("opacity", 0);
        });

	let circuitLocations = []
	circuits.forEach(c => circuitLocations.push([c["lng"], c["lat"]]))

	let circuitPath = g.selectAll("circuit")
	    .data(circuits)
		.enter()
		.append("circle")
	    .attr("class","circuit")
		.attr("cx", (d) => { return projection(+d)['lng'] })
    	.attr("cy", (d) => { return projection(+d)['lat'] })
		.attr("r", 1)
	    .attr("fill","#000")
	    .attr("stroke","#000")
		.attr("transform", (d) => {
    		return "translate(" + projection([d['lng'], d['lat']]) + ")";
		})
		.on("mouseenter", function(event, d) {
			tooltip.style("opacity", 1).text(d["name"] || "Unknown");
		})
        .on("mousemove", function(event) {
            const [mx,my] = d3.pointer(event, container.node());
            tooltip.style("left", mx + "px").style("top", my + "px");
        })
        .on("mouseleave", function() {
            tooltip.style("opacity", 0);
        });

    // On first render and on window resize, compute scale/translate to fit the world
    function resize() {
        const rect = container.node().getBoundingClientRect();
        const width = Math.max(200, rect.width);
        const height = Math.max(200, rect.height);

        // set SVG viewport
        svg.attr("viewBox", `0 0 ${width} ${height}`);

        // Choose a scale; Mercator is typically narrower vertically. This is a sensible default.
        const scale = Math.min(width / (2 * Math.PI), height / (Math.PI)) * 150;

        // Center on [0,0] (longitude 0, latitude 0) and translate to middle of svg
        projection
            .scale(scale)
            .center([0, 0])
            .translate([width / 2, height / 2]);
    }

    // Setup d3-zoom for pan & zoom with limits
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // control buttons
    d3.select("#reset").on("click", () => {
        svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity);
    });

    d3.select("#zoom-in").on("click", () => {
        svg.transition().duration(450).call(zoom.scaleBy, 1.5);
    });

    d3.select("#zoom-out").on("click", () => {
        svg.transition().duration(450).call(zoom.scaleBy, 1 / 1.5);
    });

    // initial resize and attach window resize listener
    resize();
    window.addEventListener("resize", resize);
})

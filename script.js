// Config
const topoJsonUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"; // topojson file (countries)
const circuits = "./data/circuits.csv"
const all_races = "./data/races.csv"
const distances = "./data/travel_between_races.csv"
const container = d3.select("#map");
const tooltip = container.append("div").attr("class","tooltip");

const width = Math.max(320, container.node().clientWidth || 720);
const height = 420;

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
const projection = d3.geoMercator()
const geopath_generator = d3.geoPath().projection(projection);

// Draw graticule first (so it's below countries)
const gratPath = g.append("path")
	.datum(graticule)
	.attr("class","graticule")
	.attr("fill","none")
	.attr("stroke","#e8eef8");

let updateYear;

// Load TopoJSON and render map
Promise.all([
	d3.json(topoJsonUrl),
	d3.csv(circuits),
	d3.csv(all_races),
	d3.csv(distances)
]).then(data => {
	const [topology, circuits, all_races, distances] = data
	// topojson.feature converts to GeoJSON FeatureCollection
	const countries = topojson.feature(topology, topology.objects.countries);

	// create country shapes
	g.selectAll("path.country")
		.data(countries.features)
		.enter()
		.append("path")
		.attr("class", "country")
		.attr("d", d => geopath_generator(d))
		// .on("mouseenter", function(event, d) {
			// tooltip.style("opacity", 1).text(d.properties.name || "Unknown");
		// })
		// .on("mousemove", function(event) {
			// const [mx,my] = d3.pointer(event, container.node());
			// tooltip.style("left", mx + "px").style("top", my + "px");
		// })
		// .on("mouseleave", function() {
			// tooltip.style("opacity", 0);
		// });

	let circuitLocations = []
	circuits.forEach(c => circuitLocations.push([c["lng"], c["lat"]]))

	let circuitPath = g.selectAll(".circuit")
		.data(circuits)
		.enter()
		.append("circle")
		.attr("class","circuit")
		.attr("id", function(d, i) {return `circuit ${d["id"]}`})
		.attr("cx", (d) => { return projection(+d)['lng'] })
		.attr("cy", (d) => { return projection(+d)['lat'] })
		.attr("r", 1)
		.attr("fill","#000")
		.attr("stroke","#000")
		.attr("stroke-width",3)
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
		})


	updateYear = function() {
		const race_pairs = []
		circuitPath.attr("opacity", (d) => {
			circuit = d.circuitId;
			year = document.getElementById("year").value
			opacity = 0.0;
			distances.some((race) => {
				if (race["from_circuitId"] == circuit && race["year"] == year) {
					race_pairs.push(race);
					opacity = 1.0;
					return true
				}
			})
			return opacity;
		})

		const lineSegments = race_pairs.map((pair) => {
			return [
				{name: pair.from_name, x: pair.from_lng, y: pair.from_lat, distance: pair.distance_km, from_round: pair.from_round},
				{name: pair.to_name, x: pair.to_lng, y: pair.to_lat, from_round:pair.from_round}
			]
		})

		// Magic transformations to the projection that make numbers good :D
		circuit_proj = d3.geoMercator()
			.center([-63, 27])
			.scale(153)

		// Extract unique round values
		const rounds = [...new Set(race_pairs.map(d => d.from_round))];

		// Universal domain for all rounds 1–30
		const universalRounds = d3.range(1, 31);

		const colorScale = d3.scaleOrdinal()
			.domain(universalRounds)
			.range(d3.schemeTableau10);

		path_proj = d3.geoMercator()
			.center([0, 0])
			.scale(153)

		const lineGenerator = d3.geoPath()
			.projection(path_proj)

		g.selectAll(".travel-line").remove();

		let grand_paths = g.selectAll(".travel-line")
			.data(lineSegments)
			.enter()
			.append("path")
			.attr("class", "travel-line")
			.attr("d", function(d) {
				const link = {
					type: "LineString",
					coordinates: [[d[0].x, d[0].y], [d[1].x, d[1].y]]
				}
				return lineGenerator(link)
			})
			.attr("stroke", d => colorScale(d[0].from_round))
			.attr("stroke-width", 3)
			.attr("fill", "none")
			.on("mouseenter", function(event, d) {
				tooltip.style("opacity", 1).html(`${d[0].name} -> ${d[1].name}<br>Distance: ${d[0].distance}km`);
			})
			.on("mousemove", function(event) {
				const [mx,my] = d3.pointer(event, container.node());
				tooltip.style("left", mx + "px").style("top", my + "px");
			})
			.on("mouseleave", function() {
				tooltip.style("opacity", 0);
			})
		console.log(grand_paths)
	}

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
		.scaleExtent([0.75, 8])
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

	load_init_map();
})

async function load_init_map() {
	await new Promise(r => setTimeout(r, 50))
	updateYear();
}

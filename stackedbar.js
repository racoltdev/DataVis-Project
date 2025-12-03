(function(){
    const RACES_CSV = 'data/races.csv';
    const TRAVEL_CSV = 'data/travel_between_races.csv';
    const CIRCUITS_CSV = 'data/circuits.csv';
    
    const container = d3.select('#bar');
    
    function showMessage(msg){
        container.html('');
        container.append('div')
            .attr('class','foot')
            .style('padding','18px')
            .text(msg);
    }

    Promise.all([
        d3.csv(RACES_CSV, d3.autoType),
        d3.csv(TRAVEL_CSV, d3.autoType),
        d3.csv(CIRCUITS_CSV, d3.autoType)
    ]).then(([races, travel, circuits]) => {
        
        if(!races || !travel || !circuits){
            showMessage('Missing data files.');
            return;
        }

        // Create circuit lookup
        const circuitMap = new Map();
        circuits.forEach(c => {
            circuitMap.set(c.circuitId, {
                lat: +c.lat,
                lng: +c.lng,
                name: c.name
            });
        });

        const yearSelect = d3.select('#year');

        function calculateDistances(year){
            // Get races for this year
            const yearRaces = races.filter(r => +r.year === +year).sort((a,b) => a.round - b.round);
            
            if(yearRaces.length === 0) return null;

            // Calculate distance within races (using circuit length)
            let distanceWithinRaces = 0;
            yearRaces.forEach(race => {
                const circuit = circuitMap.get(race.circuitId);
                // Assume each race is about 305km (typical F1 race distance)
                // or use race distance if available in your data
                distanceWithinRaces += 305; // km per race
            });

            // Calculate distance outside races (travel between venues)
            const travelData = travel.filter(d => +d.year === +year);
            const distanceOutsideRaces = d3.sum(travelData, d => +d.distance_km);

            return {
                year: year,
                withinRaces: distanceWithinRaces,
                outsideRaces: distanceOutsideRaces,
                total: distanceWithinRaces + distanceOutsideRaces
            };
        }

        function draw(year){
            container.html('');
            
            const distances = calculateDistances(+year);
            
            if(!distances){
                showMessage('No data for year ' + year);
                return;
            }

            const margin = {top: 40, right: 120, bottom: 40, left: 180};
            const width = Math.max(600, container.node().clientWidth || 900);
            const height = 150;

            const svg = container.append('svg')
                .attr('width', '100%')
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`)
                .style('display','block');

            const innerW = width - margin.left - margin.right;
            const innerH = height - margin.top - margin.bottom;

            const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

            // Scale for the horizontal bar
            const x = d3.scaleLinear()
                .domain([0, distances.total])
                .range([0, innerW]);

            // Colors
            const withinColor = '#3b82f6';  // blue
            const outsideColor = '#ef4444'; // red

            // Draw the stacked bar
            const barHeight = 50;
            const barY = innerH / 2 - barHeight / 2;

            // Within races segment
            g.append('rect')
                .attr('x', 0)
                .attr('y', barY)
                .attr('width', x(distances.withinRaces))
                .attr('height', barHeight)
                .attr('fill', withinColor)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);

            // Outside races segment
            g.append('rect')
                .attr('x', x(distances.withinRaces))
                .attr('y', barY)
                .attr('width', x(distances.outsideRaces))
                .attr('height', barHeight)
                .attr('fill', outsideColor)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);

            // Labels on the bars
            const withinPercent = ((distances.withinRaces / distances.total) * 100).toFixed(1);
            const outsidePercent = ((distances.outsideRaces / distances.total) * 100).toFixed(1);

            // Within races label
            if(distances.withinRaces > 0){
                g.append('text')
                    .attr('x', x(distances.withinRaces) / 2)
                    .attr('y', barY + barHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', '#fff')
                    .attr('font-size', '13px')
                    .attr('font-weight', '600')
					.attr('stroke', '#000')
                    .attr('stroke-width', '2px')
                    .attr('paint-order', 'stroke')
                    .text(`${distances.withinRaces.toLocaleString()} km (${withinPercent}%)`);
            }

            // Outside races label
            if(distances.outsideRaces > 0){
                g.append('text')
                    .attr('x', x(distances.withinRaces) + x(distances.outsideRaces) / 2)
                    .attr('y', barY + barHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', '#fff')
                    .attr('font-size', '13px')
                    .attr('font-weight', '600')
					.attr('stroke', '#000')
                    .attr('stroke-width', '2px')
                    .attr('paint-order', 'stroke')
                    .text(`${distances.outsideRaces.toLocaleString()} km (${outsidePercent}%)`);
            }

            // Legend
            const legend = g.append('g')
                .attr('transform', `translate(${innerW + 20}, 0)`);

            // Within races legend
            legend.append('rect')
                .attr('x', 0)
                .attr('y', 10)
                .attr('width', 18)
                .attr('height', 18)
                .attr('fill', withinColor);

            legend.append('text')
                .attr('x', 24)
                .attr('y', 19)
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '12px')
                .text('Within Races');

            // Outside races legend
            legend.append('rect')
                .attr('x', 0)
                .attr('y', 35)
                .attr('width', 18)
                .attr('height', 18)
                .attr('fill', outsideColor);

            legend.append('text')
                .attr('x', 24)
                .attr('y', 44)
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '12px')
                .text('Outside Races (Travel)');

            // Title
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', '600')
                .text(`Total Distance: ${distances.total.toLocaleString()} km`);

            // Axis
            g.append('g')
                .attr('transform', `translate(0, ${innerH})`)
                .call(d3.axisBottom(x).ticks(8).tickFormat(d => d.toLocaleString() + ' km'));
        }

        // Listen for year changes
        yearSelect.on('change', function(){
            const y = this.value;
            if(y) draw(+y);
        });

        // Initial draw
        const initialYear = yearSelect.property('value');
        if(initialYear) draw(+initialYear);

        // Redraw on resize
        window.addEventListener('resize', () => {
            const y = yearSelect.property('value');
            if(y) draw(+y);
        });

    }).catch(err => {
        console.error('Failed to load data', err);
        showMessage('Error loading data files.');
    });

})();
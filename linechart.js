(function(){
    const DATA_CSV = 'data/travel_between_races.csv';
    const container = d3.select('#travel-chart');

    function showMessage(msg){
        container.html('');
        container.append('div')
            .attr('class','foot')
            .style('padding','18px')
            .text(msg);
    }
	
	// // Universal domain for all rounds 1–30
	// const universalRounds = d3.range(1, 31);

	// const colorScale = d3.scaleOrdinal()
		// .domain(universalRounds)
		// .range(d3.schemeTableau10);


    d3.csv(DATA_CSV, d3.autoType).then(raw => {
        if(!raw || raw.length === 0){
            showMessage('No travel data available. Run `compute_travel.py` to generate data/travel_between_races.csv');
            return;
        }

        const data = raw.map(d => ({
            year: +d.year,
            from_round: +d.from_round,
            to_round: +d.to_round,
            distance_km: +d.distance_km,
            cumulative_km: d.cumulative_km ? +d.cumulative_km : null,
            from_name: d.from_name,
            to_name: d.to_name
        }));

        const yearSelect = d3.select('#year');

        // If year select has no value selected, set it to the latest year in data
        const currentVal = yearSelect.property('value');
        if(!currentVal){
            const maxYear = d3.max(data, d => d.year);
            if(maxYear) yearSelect.property('value', maxYear);
        }

        // create tooltip
        const tooltip = container.append('div').attr('class','tooltip').style('opacity',0);

        function draw(year){
            const rows = data.filter(d => d.year === +year).sort((a,b)=>a.from_round - b.from_round);
            container.html('');
            if(!rows.length){
                showMessage('No legs found for year ' + year);
                return;
            }

            const margin = {top: 24, right: 12, bottom: 75, left: 75};
            const width = Math.max(320, container.node().clientWidth || 720);
            const height = 420;

            const svg = container.append('svg')
                .attr('width', '100%')
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`)
                .style('display','block');

            const innerW = width - margin.left - margin.right;
            const innerH = height - margin.top - margin.bottom;

            const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

            const x = d3.scaleBand()
                .domain(rows.map((d,i)=> i ))
                .range([0, innerW])
                .padding(0.2);

            const y = d3.scaleLinear()
                .domain([0, d3.max(rows, d=> d.distance_km) * 1.05])
                .nice()
                .range([innerH, 0]);

			// Universal domain for all rounds 1–30
			const universalRounds = d3.range(1, 31);

			const colorScale = d3.scaleOrdinal()
				.domain(universalRounds)
				.range(d3.schemeTableau10);

            const xAxis = g.append('g')
                .attr('transform', `translate(0,${innerH})`)
                .call(d3.axisBottom(x).tickFormat(i => {
                    const r = rows[i];
                    return r ? `R${r.from_round}→R${r.to_round}` : '';
                }))
                .selectAll('text')
                .style('text-anchor','end')
                .attr('transform','rotate(-40)')
                ;

            g.append('g')
                .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + ' km'));

            // bars with color coding by round
            g.selectAll('rect.bar')
                .data(rows)
                .enter()
                .append('rect')
                .attr('class','bar')
                .attr('x', (d,i) => x(i))
                .attr('y', d => y(d.distance_km))
                .attr('width', x.bandwidth())
                .attr('height', d => Math.max(1, innerH - y(d.distance_km)))
                .attr('fill', d => colorScale(d.from_round))
                .on('mousemove', function(event, d){
                    const [mx,my] = d3.pointer(event, container.node());
                    tooltip.style('opacity',1)
                        .style('left', mx + 'px')
                        .style('top', (my - 24) + 'px')
                        .html(`${d.from_name} → ${d.to_name}<br/><strong>${d.distance_km} km</strong>`);
                })
                .on('mouseleave', function(){ tooltip.style('opacity',0); });

            // distance labels on top of bars (vertical orientation, one decimal place)
            g.selectAll('text.bar-label')
                .data(rows)
                .enter()
                .append('text')
                .attr('class','bar-label')
                .attr('x', (d,i) => x(i) + x.bandwidth()/2)
                .attr('y', d => y(d.distance_km) - 4)
                .attr('text-anchor','top')
                .attr('dominant-baseline','auto')
                .attr('font-size','11px')
                .attr('font-weight','600')
                .attr('fill','#111827')
                .attr('transform', (d,i) => {
                    const xi = x(i) + x.bandwidth()/2;
                    const yi = y(d.distance_km) - 10;
                    return `rotate(-90 ${xi} ${yi})`;
                })
                .text(d => d.distance_km.toFixed(1));

            // axis labels
            svg.append('text')
                .attr('x', margin.left + innerW / 2)
                .attr('y', height - 6)
                .attr('text-anchor','middle')
                .attr('class','foot')
                .text('Leg (from → to)');

            svg.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('x', - (margin.top + innerH/2))
                .attr('y', 10)
                .attr('text-anchor','middle')
                .attr('class','foot')
                .text('Distance (km)');
        }

        // initial draw
        const initialYear = +yearSelect.property('value');
        if(initialYear) draw(initialYear);

        yearSelect.on('change', function(){
            const y = +this.value;
            draw(y);
        });

        // redraw on window resize for responsiveness
        window.addEventListener('resize', () => {
            const y = +yearSelect.property('value');
            if(y) draw(y);
        });

    }).catch(err => {
        console.error('Failed to load travel data CSV', err);
        container.html('');
        container.append('div').attr('class','foot').text('Error loading travel data.');
    });

})();

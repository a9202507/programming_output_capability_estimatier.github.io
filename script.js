document.getElementById('calculate').addEventListener('click', async () => {
    const demand = parseInt(document.getElementById('demand').value);
    const K1 = parseFloat(document.getElementById('K1').value);
    const K2 = parseFloat(document.getElementById('K2').value);
    const configUpH = parseFloat(document.getElementById('config_uph').value);
    const startDate = document.getElementById('start_date').value;
    const startTime = document.getElementById('start_time').value;
    const startDatetime = new Date(`${startDate}T${startTime}:00`);

    console.log("開始時間: ", startDatetime);

    let workingTime;
    try {
        const response = await fetch('public/working_time.json'); // 確保路徑正確
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        workingTime = await response.json();
    } catch (error) {
        console.error("Error fetching working_time.json:", error);
        document.getElementById('result').textContent = "Error loading working time configuration.";
        return;
    }

    console.log("Working time configuration loaded:", workingTime);

    const addWorkingHours = (startDatetime, hours, phase) => {
        let currentDatetime = new Date(startDatetime);
        while (hours > 0) {
            if (isValidWorkingTime(currentDatetime, phase)) {
                const endOfDay = new Date(currentDatetime);
                const [endHour, endMinute] = workingTime[phase].end_time.split(':').map(Number);
                endOfDay.setHours(endHour, endMinute, 0, 0);
                const remainingHoursToday = (endOfDay - currentDatetime) / 3600 / 1000;

                if (remainingHoursToday >= hours) {
                    currentDatetime.setHours(currentDatetime.getHours() + hours);
                    hours = 0;
                } else {
                    currentDatetime.setHours(currentDatetime.getHours() + remainingHoursToday);
                    hours -= remainingHoursToday;
                }
            }
            currentDatetime = nextValidStart(currentDatetime, phase);
        }
        return currentDatetime;
    };

    const isValidWorkingTime = (dt, phase) => {
        const startHour = parseInt(workingTime[phase].start_time.split(':')[0]);
        const startMinute = parseInt(workingTime[phase].start_time.split(':')[1]);
        const endHour = parseInt(workingTime[phase].end_time.split(':')[0]);
        const endMinute = parseInt(workingTime[phase].end_time.split(':')[1]);
        const workingDays = workingTime[phase].working_days;
        const day = dt.getDay();
        const hour = dt.getHours();
        const minute = dt.getMinutes();
        return workingDays.includes(day) && 
            (hour > startHour || (hour === startHour && minute >= startMinute)) &&
            (hour < endHour || (hour === endHour && minute < endMinute));
    };

    const nextValidStart = (dt, phase) => {
        while (!isValidWorkingTime(dt, phase)) {
            dt.setMinutes(dt.getMinutes() + 1);
        }
        return dt;
    };

    const estimateProductionTime = (demand, K1, K2, configUpH, startDatetime) => {
        const settingStart = nextValidStart(new Date(startDatetime), 'setting');
        const settingEnd = addWorkingHours(settingStart, K1, 'setting');

        const productionStart = settingEnd;
        const configProductionTime = demand / configUpH;
        const productionEnd = new Date(productionStart.getTime() + configProductionTime * 3600 * 1000);

        const packingStart = nextValidStart(productionEnd, 'packing');
        const packingEnd = addWorkingHours(packingStart, K2, 'packing');

        const shippingTime = nextValidStart(packingEnd, 'packing');

        return {
            settingStart,
            settingEnd,
            productionStart,
            productionEnd,
            packingStart,
            packingEnd,
            shippingTime
        };
    };

    const times = estimateProductionTime(demand, K1, K2, configUpH, startDatetime);

    const timeFormat = (date) => date.toLocaleString('en-US', { timeZone: 'Asia/Taipei', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    document.getElementById('result').textContent = `
    前段設置開始時間: ${timeFormat(times.settingStart)}\n
    前段設置結束時間: ${timeFormat(times.settingEnd)}\n
    燒錄開始時間: ${timeFormat(times.productionStart)}\n
    燒錄結束時間: ${timeFormat(times.productionEnd)}\n
    燒錄總共花費: ${((times.productionEnd - times.productionStart) / 3600 / 1000).toFixed(2)} 小時\n
    後段打包開始時間: ${timeFormat(times.packingStart)}\n
    後段打包結束時間: ${timeFormat(times.packingEnd)}\n
    預估出貨時間: ${timeFormat(times.shippingTime)}\n
    `;
});


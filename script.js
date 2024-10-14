document.getElementById("calculate").addEventListener("click", async () => {
  const demand = parseInt(document.getElementById("demand").value);
  const K1 = parseFloat(document.getElementById("K1").value);
  const K2 = parseFloat(document.getElementById("K2").value);
  const configUpH = parseFloat(document.getElementById("config_uph").value);
  const startDate = document.getElementById("start_date").value;
  const startTime = document.getElementById("start_time").value;
  const startDatetime = new Date(`${startDate}T${startTime}:00`);

  console.log("start time: ", startDatetime);

  let workingTime;
  try {
    const response = await fetch("public/working_time.json"); // 確保路徑正確
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    workingTime = await response.json();
  } catch (error) {
    console.error("Error fetching working_time.json:", error);
    document.getElementById("result").textContent =
      "Error loading working time configuration.";
    return;
  }

  console.log("Working time configuration loaded:", workingTime);

  const addWorkingHours = (startDatetime, hours, phase) => {
    let currentDatetime = new Date(startDatetime);
    if (phase === "production") {
      // For production phase, simply add hours without considering working time
      currentDatetime.setTime(currentDatetime.getTime() + hours * 3600 * 1000);
      return currentDatetime;
    }

    while (hours > 0) {
      if (isValidWorkingTime(currentDatetime, phase)) {
        const endOfDay = new Date(currentDatetime);
        const [endHour, endMinute] = workingTime[phase].end_time
          .split(":")
          .map(Number);
        endOfDay.setHours(endHour, endMinute, 0, 0);
        const remainingHoursToday = (endOfDay - currentDatetime) / 3600 / 1000;

        if (remainingHoursToday >= hours) {
          currentDatetime.setTime(
            currentDatetime.getTime() + hours * 3600 * 1000
          );
          hours = 0;
        } else {
          currentDatetime.setTime(
            currentDatetime.getTime() + remainingHoursToday * 3600 * 1000
          );
          hours -= remainingHoursToday;
        }
      }
      currentDatetime = nextValidStart(currentDatetime, phase);
    }
    return currentDatetime;
  };

  const isValidWorkingTime = (dt, phase) => {
    const startHour = parseInt(workingTime[phase].start_time.split(":")[0]);
    const startMinute = parseInt(workingTime[phase].start_time.split(":")[1]);
    const endHour = parseInt(workingTime[phase].end_time.split(":")[0]);
    const endMinute = parseInt(workingTime[phase].end_time.split(":")[1]);
    const workingDays = workingTime[phase].working_days;
    const day = dt.getDay();
    const hour = dt.getHours();
    const minute = dt.getMinutes();
    return (
      workingDays.includes(day) &&
      (hour > startHour || (hour === startHour && minute >= startMinute)) &&
      (hour < endHour || (hour === endHour && minute < endMinute))
    );
  };

  const nextValidStart = (dt, phase) => {
    const newDt = new Date(dt);
    while (!isValidWorkingTime(newDt, phase)) {
      newDt.setTime(newDt.getTime() + 60000); // Add one minute
    }
    return newDt;
  };

  const estimateProductionTime = (demand, K1, K2, configUpH, startDatetime) => {
    const settingStart = nextValidStart(new Date(startDatetime), "setting");
    const settingEnd = addWorkingHours(settingStart, K1, "setting");

    const productionStart = settingEnd;
    const configProductionTime = demand / configUpH;

    // 計算實際生產結束時間
    const actualProductionEnd = new Date(
      productionStart.getTime() + configProductionTime * 3600 * 1000
    );

    // 找到下一個有效的包裝開始時間
    let packingStart = nextValidStart(actualProductionEnd, "packing");

    // 如果包裝開始時間和實際生產結束時間不同，說明中間有非工作時間（如週末）
    if (packingStart.getTime() !== actualProductionEnd.getTime()) {
      console.log("Production spans non-working hours. Adjusting end time.");
    }

    const packingEnd = addWorkingHours(packingStart, K2, "packing");
    const shippingTime = nextValidStart(packingEnd, "packing");

    return {
      settingStart,
      settingEnd,
      productionStart,
      productionEnd: actualProductionEnd,
      packingStart,
      packingEnd,
      shippingTime,
      actualProductionTime:
        (actualProductionEnd - productionStart) / (3600 * 1000),
    };
  };

  const times = estimateProductionTime(
    demand,
    K1,
    K2,
    configUpH,
    startDatetime
  );

  const timeFormat = (date) =>
    date.toLocaleString("en-US", {
      timeZone: "Asia/Taipei",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  document.getElementById("result").textContent = `
    front-end start: ${timeFormat(times.settingStart)}
    front-end end: ${timeFormat(times.settingEnd)}
    fornt-end total: ${(
      (times.settingEnd - times.settingStart) /
      3600 /
      1000
    ).toFixed(2)} hours
    programming start: ${timeFormat(times.productionStart)}
    programming end: ${timeFormat(times.productionEnd)}
    total programming time: ${times.actualProductionTime.toFixed(2)} hours
    back-end start: ${timeFormat(times.packingStart)}
    back-end end: ${timeFormat(times.packingEnd)}
    total back-end time: ${(
      (times.packingEnd - times.packingStart) /
      3600 /
      1000
    ).toFixed(2)} hours
    Shipping estimation time: ${timeFormat(times.shippingTime)}
    Order to shipping time: ${(
      (times.shippingTime - times.settingStart) /
      3600 /
      1000
    ).toFixed(2)} hours
    `;

  console.log("詳細時間信息：", times);
  console.log(
    "顯示在網頁上的結果：",
    document.getElementById("result").textContent
  );
});

document.addEventListener("DOMContentLoaded", function () {
  // Set default date to today
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0];
  document.getElementById("start_date").value = formattedDate;
});

document.getElementById("calculate").addEventListener("click", async () => {
  const demand = parseInt(document.getElementById("demand").value);
  const K1 = parseFloat(document.getElementById("K1").value);
  const K2 = parseFloat(document.getElementById("K2").value);
  const configUpH = parseFloat(document.getElementById("config_uph").value);
  const startDate = document.getElementById("start_date").value;
  const startTime = document.getElementById("start_time").value;
  const startDatetime = new Date(`${startDate}T${startTime}:00`);

  console.log("開始時間: ", startDatetime);

  // Rest of the code remains the same...
});

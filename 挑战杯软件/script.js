let accelerationChart;
let gyroscopeChart;

// 位置追踪相关功能
let currentPosition = null;

// 设备状态监测
let deviceData = {
    batteryLevel: 100,
    airbagStatus: '正常',
    deviceStatus: '在线',
    lastUpdate: new Date()
};

// 健康数据管理
let healthData = {
    steps: 0,
    fallHistory: [],
    monthlyStats: {
        falls: 0,
        avgSteps: 0
    }
};

// 初始化图表
function initCharts() {
    const accCtx = document.getElementById('accelerationChart').getContext('2d');
    const gyroCtx = document.getElementById('gyroscopeChart').getContext('2d');

    accelerationChart = new Chart(accCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '加速度总量',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
    });

    gyroscopeChart = new Chart(gyroCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '角速度总量',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }]
        }
    });
}

// 处理CSV文件
function processFile() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) {
        alert('请选择文件');
        return;
    }

    // 重置健康数据
    healthData = {
        steps: 0,
        fallHistory: [],
        monthlyStats: {
            falls: 0,
            avgSteps: 0
        }
    };

    const reader = new FileReader();
    reader.onload = function(event) {
        const csvData = event.target.result;
        const data = parseCSV(csvData);
        
        // 清除旧图表数据
        accelerationChart.data.labels = [];
        accelerationChart.data.datasets[0].data = [];
        gyroscopeChart.data.labels = [];
        gyroscopeChart.data.datasets[0].data = [];
        
        updateCharts(data);
        detectFalls(data);
        updateHealthData(data);
    };
    reader.readAsText(file);
}

// 解析CSV数据
function parseCSV(csvData) {
    const lines = csvData.split('\n');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].split(',');
        if (line.length >= 7) {
            try {
                const ax = parseFloat(line[1]);
                const ay = parseFloat(line[2]);
                const az = parseFloat(line[3]);
                const wx = parseFloat(line[4]);
                const wy = parseFloat(line[5]);
                const wz = parseFloat(line[6]);
                
                const atotal = Math.sqrt(ax*ax + ay*ay + az*az);
                const wtotal = Math.sqrt(wx*wx + wy*wy + wz*wz);
                
                // 直接使用原始时间字符串，不进行转换
                const time = line[0].trim();
                
                data.push({
                    time: time,
                    atotal: atotal,
                    wtotal: wtotal
                });
            } catch (e) {
                console.error('解析行数据错误:', e);
                continue; // 跳过错误的行
            }
        }
    }
    return data;
}

// 更新图表
function updateCharts(data) {
    const times = data.map(d => d.time);
    const atotals = data.map(d => d.atotal);
    const wtotals = data.map(d => d.wtotal);

    accelerationChart.data.labels = times;
    accelerationChart.data.datasets[0].data = atotals;
    accelerationChart.update();

    gyroscopeChart.data.labels = times;
    gyroscopeChart.data.datasets[0].data = wtotals;
    gyroscopeChart.update();
}

// 检测跌倒
function detectFalls(data) {
    const fallList = document.getElementById('fallList');
    fallList.innerHTML = '';
    
    let activities = [];
    let currentActivity = data.length > 0 ? {
        type: '正常行走',
        startTime: data[0].time,
        endTime: data[0].time
    } : null;
    
    let isFalling = false;
    
    // 遍历数据识别活动
    data.forEach((point, index) => {
        const isFallDetected = point.atotal > 8.0 && point.wtotal > 3.5;
        
        // 状态发生改变
        if (isFallDetected !== isFalling) {
            // 记录上一个活动
            if (currentActivity) {
                currentActivity.endTime = point.time;
                activities.push({...currentActivity});
            }
            
            // 开始新活动
            if (isFallDetected) {
                currentActivity = {
                    type: '跌倒',
                    startTime: point.time,
                    endTime: point.time
                };
                // 检测到新的跌倒时通知
                notifyEmergencyContact();
            } else {
                currentActivity = {
                    type: '正常行走',
                    startTime: point.time,
                    endTime: point.time
                };
            }
            isFalling = isFallDetected;
        } else {
            // 更新当前活动的结束时间
            if (currentActivity) {
                currentActivity.endTime = point.time;
            }
        }
        
        // 处理最后一个数据点
        if (index === data.length - 1 && currentActivity) {
            activities.push({...currentActivity});
        }
    });
    
    // 显示活动记录
    activities.forEach(activity => {
        const li = document.createElement('li');
        const duration = calculateDuration(activity.startTime, activity.endTime);
        
        if (activity.type === '跌倒') {
            li.innerHTML = `<span style="color: red;">⚠️ 检测到跌倒</span> - 
                          从 ${formatTime(activity.startTime)} 
                          到 ${formatTime(activity.endTime)}
                          (持续: ${duration})`;
        } else {
            li.innerHTML = `<span style="color: green;">正常行走</span> - 
                          从 ${formatTime(activity.startTime)} 
                          到 ${formatTime(activity.endTime)}
                          (持续: ${duration})`;
        }
        fallList.appendChild(li);
    });
}

// 格式化时间显示
function formatTime(timeStr) {
    try {
        // 如果时间字符串包含毫秒
        if (timeStr.includes('.')) {
            return timeStr;
        }
        return timeStr;
    } catch (e) {
        console.error('时间格式化错误:', e);
        return timeStr;
    }
}

// 计算持续时间
function calculateDuration(startTime, endTime) {
    try {
        // 将时间字符串转换为数字（假设是秒）
        const start = parseFloat(startTime);
        const end = parseFloat(endTime);
        
        if (isNaN(start) || isNaN(end)) {
            return '时间计算错误';
        }
        
        const diff = (end - start) * 1000; // 转换为毫秒
        
        // 如果持续时间小于1秒
        if (diff < 1000) {
            return `${Math.round(diff)}毫秒`;
        }
        
        const seconds = Math.floor(diff / 1000);
        const milliseconds = Math.round(diff % 1000);
        
        if (seconds < 60) {
            return `${seconds}秒${milliseconds}毫秒`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}分${remainingSeconds}秒${milliseconds}毫秒`;
    } catch (e) {
        console.error('持续时间计算错误:', e);
        return '时间计算错误';
    }
}

// 保存紧急联系人
function saveContact() {
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    
    if (name && phone) {
        localStorage.setItem('emergencyContact', JSON.stringify({name, phone}));
        alert('紧急联系人保存成功！');
    } else {
        alert('请填写完整的联系人信息');
    }
}

// 通知紧急联系人（示例函数）
function notifyEmergencyContact() {
    const contact = JSON.parse(localStorage.getItem('emergencyContact'));
    if (contact) {
        const message = `检测到跌倒\n联系人：${contact.name}\n`;
        
        if (currentPosition) {
            const mapLink = `https://maps.google.com/?q=${currentPosition.latitude},${currentPosition.longitude}`;
            console.log(`${message}位置：${mapLink}`);
        }
        
        // 记录跌倒历史
        healthData.fallHistory.push({
            time: new Date(),
            location: currentPosition
        });
        
        if (confirm(`检测到跌倒！是否立即呼叫紧急联系人：${contact.name}？`)) {
            emergencyCall();
        }
    }
}

// 添加紧急呼叫功能
function emergencyCall() {
    const contact = JSON.parse(localStorage.getItem('emergencyContact'));
    if (!contact || !contact.phone) {
        alert('请先设置紧急联系人电话！');
        return;
    }
    
    // 使用tel协议拨打电话
    const telLink = document.createElement('a');
    telLink.href = `tel:${contact.phone}`;
    telLink.click();
    
    // 显示呼叫信息
    alert(`正在呼叫联系人：${contact.name} (${contact.phone})`);
}

// 位置追踪相关功能
function updateLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                document.getElementById('locationDisplay').innerHTML = 
                    `纬度: ${currentPosition.latitude.toFixed(6)}<br>经度: ${currentPosition.longitude.toFixed(6)}`;
            },
            error => {
                alert('无法获取位置信息: ' + error.message);
            }
        );
    } else {
        alert('您的浏览器不支持地理位置功能');
    }
}

// 设备状态监测
function updateDeviceStatus() {
    // 模拟电量消耗
    deviceData.batteryLevel = Math.max(0, deviceData.batteryLevel - Math.random() * 2);
    
    // 更新显示
    const batteryBar = document.querySelector('.battery-bar');
    batteryBar.style.width = `${deviceData.batteryLevel}%`;
    document.querySelector('.battery-text').textContent = `${Math.round(deviceData.batteryLevel)}%`;
    
    // 电量警告
    if (deviceData.batteryLevel < 20) {
        alert('设备电量低，请及时充电！');
    }
    
    // 模拟设备状态检查
    if (Math.random() < 0.05) { // 5%概率出现故障
        deviceData.airbagStatus = '需要检查';
        document.getElementById('airbagStatus').textContent = deviceData.airbagStatus;
        alert('检测到气囊系统异常，请及时检查！');
    }
}

// 健康数据管理
function updateHealthData(data) {
    // 计算步数（简单示例：根据加速度变化估算）
    data.forEach(point => {
        if (point.atotal > 1.2 && point.atotal < 1.8) { // 假设这个范围代表走路
            healthData.steps += 1;
        }
    });
    
    document.getElementById('stepCount').textContent = healthData.steps;
}

// 健康数据管理
function generateReport() {
    const report = {
        period: '最近30天',
        totalSteps: healthData.steps,
        avgStepsPerDay: Math.round(healthData.steps / 30),
        fallCount: healthData.fallHistory.length,
        recommendations: []
    };
    
    // 生成建议
    if (report.avgStepsPerDay < 5000) {
        report.recommendations.push('建议增加日常运动量');
    }
    if (report.fallCount > 0) {
        report.recommendations.push('建议进行平衡能力训练');
    }
    
    // 显示报告
    const reportWindow = window.open('', '健康报告', 'width=600,height=800');
    reportWindow.document.write(`
        <h1>健康数据分析报告</h1>
        <p>统计周期: ${report.period}</p>
        <p>总步数: ${report.totalSteps}</p>
        <p>日均步数: ${report.avgStepsPerDay}</p>
        <p>���倒次数: ${report.fallCount}</p>
        <h2>建议</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    `);
}

// 定时更新设备状态
setInterval(updateDeviceStatus, 60000); // 每分钟更新一次

// 页面加载时初始化图表
window.onload = function() {
    initCharts();
    updateLocation();
    updateDeviceStatus();
};
 
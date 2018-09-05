$(document).ready(function() {
    var authorizationJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NhbmRib3guYXV0aDAtZXh0ZW5kLmNvbSIsInN1YiI6ImRpZWdvY2FyZEBnbWFpbC5jb20iLCJhdWQiOiJteV9kZXBsb3ltZW50X2lkIn0.gwmoCngdwW58-ZXSbhrvvkask2tGpaAI2Hr8Wl04-es";

    $.ajax({
        method: 'GET',
        url:'https://wt-350edaf6de1a9a1beb1ac87dc1fc39de-0.sandbox.auth0-extend.com/authorization/analytics',
        cache:false,
        beforeSend: function(request) {
            request.setRequestHeader("Authorization", "Bearer " + authorizationJWT);
        },
        contentType: "application/json",
        complete: function (response) {
           var analyticsData = JSON.parse(response.responseText);
           globalAnalyticsData = analyticsData;
           drawSummary(analyticsData.summary);
           drawCharts(analyticsData);
        },
        error: function () {
            alert('Opps. There was an when retrieving data');
        },
    });
});

function drawSummary(summaryData) {
    $('#adminCount').html(summaryData.adminCount);
    $('#adminAccess').html(summaryData.adminAccess);
    $('#ownerCount').html(summaryData.ownerCount);
    $('#ownerAccess').html(summaryData.ownerAccess);
}

function drawCharts(analyticsData) {
    'use strict';

    Chart.defaults.global.defaultFontColor = '#75787c';


    // ------------------------------------------------------- //
    // Line Chart
    // ------------------------------------------------------ //
    var legendState = true;
    if ($(window).outerWidth() < 576) {
        legendState = false;
    }

    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var today = new Date().getDay();
    var dayLabels = [days[today+1], days[(today+2)%7], days[(today+3)%7], days[(today+4)%7], days[(today+5)%7], days[(today+6)%7], days[(today)%7]];
    var maxAdminSuccess = Math.max.apply(Math, analyticsData.thisWeek.adminSuccess);
    var maxOwnerSuccess = Math.max.apply(Math, analyticsData.thisWeek.ownerSuccess);

    var LINECHART = $('#lineCahrt');
    var myLineChart = new Chart(LINECHART, {
        type: 'line',
        options: {
            scales: {
                xAxes: [{
                    display: true,
                    gridLines: {
                        display: false
                    }
                }],
                yAxes: [{
                    ticks: {
                        max: Math.max(maxAdminSuccess, maxOwnerSuccess) + 1, // 10
                        min: 0 // 1
                    },
                    display: true,
                    gridLines: {
                        display: false
                    }
                }]
            },
            legend: {
                display: legendState
            }
        },
        data: {
            labels: dayLabels,
            datasets: [
                {
                    label: "Admin access",
                    fill: true,
                    lineTension: 0.2,
                    backgroundColor: "transparent",
                    borderColor: "#EF8C99",
                    pointBorderColor: '#EF8C99',
                    pointHoverBackgroundColor: "#EF8C99",
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    borderWidth: 2,
                    pointBackgroundColor: "#fff",
                    pointBorderWidth: 5,
                    pointHoverRadius: 5,
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 0,
                    data: analyticsData.thisWeek.adminSuccess, // [5,3,7,4,8,4,3]
                    spanGaps: false
                },
                {
                    label: "Owner access",
                    fill: true,
                    lineTension: 0.2,
                    backgroundColor: "transparent",
                    borderColor: '#864DD9',
                    pointBorderColor: '#864DD9',
                    pointHoverBackgroundColor: '#864DD9',
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    borderWidth: 2,
                    pointBackgroundColor: "#fff",
                    pointBorderWidth: 5,
                    pointHoverRadius: 5,
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    data:  analyticsData.thisWeek.ownerSuccess, // [7,4,5,7,5,6,4],
                    spanGaps: false
                }
            ]
        }
    });



    // ------------------------------------------------------- //
    // Bar Chart
    // ------------------------------------------------------ //
    var BARCHARTEXMPLE    = $('#barChartExample1');
    var barChartExample = new Chart(BARCHARTEXMPLE, {
        type: 'bar',
        options: {
            scales: {
                xAxes: [{
                    display: false,
                    gridLines: {
                        color: '#eee'
                    }
                }],
                yAxes: [{
                    display: false,
                    gridLines: {
                        color: '#eee'
                    }
                }]
            },
        },
        data: {
            labels: dayLabels, // ["January", "February", "March", "April", "May", "June", "July"],
            datasets: [
                {
                    label: "Allowed",
                    backgroundColor: [
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)"
                    ],
                    hoverBackgroundColor: [
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)",
                        "rgba(238, 139, 152, 0.7)"
                    ],
                    borderColor: [
                        "rgba(238, 139, 152, 1)",
                        "rgba(238, 139, 152, 1)",
                        "rgba(238, 139, 152, 1)",
                        "rgba(238, 139, 152, 1)",
                        "rgba(238, 139, 152, 1)",
                        "rgba(238, 139, 152, 1)",
                        "rgba(238, 139, 152, 1)"
                    ],
                    borderWidth: 1,
                    data: analyticsData.thisWeek.adminSuccess // [65, 59, 80, 81, 56, 55, 40],
                },
                {
                    label: "Denied",
                    backgroundColor: [
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)"
                    ],
                    hoverBackgroundColor: [
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)"
                    ],
                    borderColor: [
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)"
                    ],
                    borderWidth: 1,
                    data: analyticsData.thisWeek.adminFailed,
                }
            ]
        }
    });


    // ------------------------------------------------------- //
    // Bar Chart
    // ------------------------------------------------------ //
    var BARCHARTEXMPLE    = $('#barChartExample2');
    var barChartExample = new Chart(BARCHARTEXMPLE, {
        type: 'bar',
        options: {
            scales: {
                xAxes: [{
                    display: false,
                    gridLines: {
                        color: '#eee'
                    }
                }],
                yAxes: [{
                    display: false,
                    gridLines: {
                        color: '#eee'
                    }
                }]
            },
        },
        data: {
            labels: dayLabels,
            datasets: [
                {
                    label: "Allowed",
                    backgroundColor: [
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)"
                    ],
                    hoverBackgroundColor: [
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)",
                        "rgba(134, 77, 217, 0.57)"
                    ],
                    borderColor: [
                        "rgba(134, 77, 217, 1)",
                        "rgba(134, 77, 217, 1)",
                        "rgba(134, 77, 217, 1)",
                        "rgba(134, 77, 217, 1)",
                        "rgba(134, 77, 217, 1)",
                        "rgba(134, 77, 217, 1)",
                        "rgba(134, 77, 217, 1)"
                    ],
                    borderWidth: 1,
                    data: analyticsData.thisWeek.ownerSuccess,
                },
                {
                    label: "Denied",
                    backgroundColor: [
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)"
                    ],
                    hoverBackgroundColor: [
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)"
                    ],
                    borderColor: [
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)",
                        "rgba(75, 75, 75, 0.7)"
                    ],
                    borderWidth: 1,
                    data: analyticsData.thisWeek.ownerFailed,
                }
            ]
        }
    });

    // ------------------------------------------------------- //
    // Bar Chart 1
    // ------------------------------------------------------ //

    var adminWeeklyEvolution = analyticsData.thisWeek.adminSuccess.map(function(item, index) {
        return item - analyticsData.previousWeek.adminSuccess[index];
    });
    var adminWeeklyDifference = adminWeeklyEvolution.reduce(function(a, b) { return a + b }, 0);
    $("#adminEvolution").html(adminWeeklyDifference > 0 ? "+" + adminWeeklyDifference : "-" + adminWeeklyDifference);
    var BARCHART1 = $('#salesBarChart1');
    var barChartHome = new Chart(BARCHART1, {
        type: 'bar',
        options:
        {
            scales:
            {
                xAxes: [{
                    display: false,
                    barPercentage: 0.2
                }],
                yAxes: [{
                    display: false
                }],
            },
            legend: {
                display: false
            }
        },
        data: {
            labels: dayLabels,
            datasets: [
                {
                    label: "Data Set 1",
                    backgroundColor: [
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99'
                    ],
                    borderColor: [
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99',
                        '#EF8C99'
                    ],
                    borderWidth: 0.2,
                    data: adminWeeklyEvolution  // [35, 55, 65, 85, 40, 30, 18, 35, 20, 70]
                }
            ]
        }
    });

    // ------------------------------------------------------- //
    // Bar Chart 21
    // ------------------------------------------------------ //
    var BARCHART1 = $('#salesBarChart2');
    var ownerWeeklyEvolution = analyticsData.thisWeek.ownerSuccess.map(function(item, index) {
        return item - analyticsData.previousWeek.ownerSuccess[index];
    });
    var ownerWeeklyDifference = ownerWeeklyEvolution.reduce(function(a, b) { return a + b }, 0);
    $("#ownerEvolution").html(ownerWeeklyDifference > 0 ? "+" + ownerWeeklyDifference : "-" + ownerWeeklyDifference);
    var barChartHome = new Chart(BARCHART1, {
        type: 'bar',
        options:
        {
            scales:
            {
                xAxes: [{
                    display: false,
                    barPercentage: 0.2
                }],
                yAxes: [{
                    display: false
                }],
            },
            legend: {
                display: false
            }
        },
        data: {
            labels: dayLabels,
            datasets: [
                {
                    label: "Data Set 1",
                    backgroundColor: [
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9'
                    ],
                    borderColor: [
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9',
                        '#864DD9'
                    ],
                    borderWidth: 0.2,
                    data: ownerWeeklyEvolution
                }
            ]
        }
    });


    // ------------------------------------------------------- //
    // Pie Chart
    // ------------------------------------------------------ //
    var PIECHARTEXMPLE    = $('#visitPieChart');
    var adminWeeklyBreakdownSuccess = analyticsData.thisWeek.adminSuccess.reduce(function(a, b) { return a + b }, 0);
    var adminWeeklyBreakdownFailed = analyticsData.thisWeek.adminFailed.reduce(function(a, b) { return a + b }, 0);
    var ownerWeeklyBreakdownSuccess = analyticsData.thisWeek.ownerSuccess.reduce(function(a, b) { return a + b }, 0);
    var ownerWeeklyBreakdownFailed = analyticsData.thisWeek.ownerFailed.reduce(function(a, b) { return a + b }, 0);
    $("#weeklyBreakdown").html(adminWeeklyBreakdownSuccess + adminWeeklyBreakdownFailed + ownerWeeklyBreakdownSuccess + ownerWeeklyBreakdownFailed);
    var pieChartExample = new Chart(PIECHARTEXMPLE, {
        type: 'pie',
        options: {
            legend: {
                display: false
            }
        },
        data: {
            labels: [
                "Admin allowed",
                "Admin denied",
                "Owner allowed",
                "Owner denied"
            ],
            datasets: [
                {
                    data: [
                        adminWeeklyBreakdownSuccess,
                        adminWeeklyBreakdownFailed,
                        ownerWeeklyBreakdownSuccess,
                        ownerWeeklyBreakdownFailed
                    ],
                    borderWidth: 0,
                    backgroundColor: [
                        '#da4d60',
                        "#e96577",
                        '#723ac3',
                        "#864DD9"
                    ],
                    hoverBackgroundColor: [
                        '#da4d60',
                        "#e96577",
                        '#723ac3',
                        "#864DD9"
                    ]
                }]
            }
    });

    var pieChartExample = {
        responsive: true
    };

}
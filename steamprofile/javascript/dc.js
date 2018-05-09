// Tooltip
jQuery(function($) {
    $('.tooltip').v_tooltip();
    $('#global_header .supernav').v_tooltip({'location':'bottom', 'destroyWhenDone': false, 'tooltipClass': 'supernav_content', 'offsetY':-4, 'offsetX': 1, 'horizontalSnap': 4, 'tooltipParent': '#global_header .supernav_container', 'correctForScreenSize': false});
});

// Notification counter
$J(EnableNotificationCountPolling);

// Register Flyout
RegisterFlyout( 'account_language_pulldown', 'language_dropdown', 'leftsubmenu', 'bottomsubmenu', true );

g_sessionID = "b87c7f9a58a5bd344df8447f";
g_steamID = "76561198008822803";

// We always want to have the timezone cookie set for PHP to use
setTimezoneCookies();

$J( function() {

    InitMiniprofileHovers();
    InitEmoticonHovers();
    window.BindCommunityTooltip = function( $Selector ) { $Selector.v_tooltip( {'tooltipClass': 'community_tooltip', 'dataName': 'communityTooltip' } ); };
    BindCommunityTooltip( $J('[data-community-tooltip]') );
});

$J( function() { InitEconomyHovers( "http:\/\/community.edgecast.steamstatic.com\/public\/css\/skin_1\/economy.css?v=q6EkkWwqjgQx", "http:\/\/community.edgecast.steamstatic.com\/public\/javascript\/economy_common.js?v=tsXdRVB0yEaR&l=english", "http:\/\/community.edgecast.steamstatic.com\/public\/javascript\/economy.js?v=DNiCDdc9ihXn&l=english" );});

g_rgProfileData = {"url":"http:\/\/steamcommunity.com\/id\/diegocard\/","steamid":"76561198008822803","personaname":"DC","summary":" <b>Contact<\/b> <br>• Mail: <a href=\"mailto:diegocard@gmail.com\">diegocard@gmail.com<\/a><br>• Phone: (+598) 99687570<br><br>"};
$J( function() {
    window.Responsive_ReparentItemsInResponsiveMode && Responsive_ReparentItemsInResponsiveMode( '.responsive_groupfriends_element', $J('#responsive_groupfriends_element_ctn') );
});

$J( function() { InitProfileSummary( g_rgProfileData['summary'] ); } );

$J(function () {
    InitializeCommentThread("Profile", "Profile_76561198008822803_0", {
        "feature": "-1",
        "feature2": 0,
        "owner": "76561198008822803",
        "total_count": 0,
        "start": 0,
        "pagesize": 6,
        "has_upvoted": 0,
        "upvotes": 0,
        "votecountid": null,
        "voteupid": null,
        "commentcountid": null,
        "subscribed": false
    }, 'http://steamcommunity.com/comment/Profile/', 40);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('./service-worker.js')
        .then(function() { console.log('Service Worker Registered'); });
    navigator.serviceWorker
        .ready
        .then(function(registration) { console.log('Service Worker Ready'); }
    );
}
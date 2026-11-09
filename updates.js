// Patch notes, shown on /updates (newest first).
// To ship the next update, add an entry with the next number (n: 2, 3, ...), the date
// (YYYY-MM-DD), a short title and a few plain-text bullets (no HTML: it's escaped).
// The entry with the highest number is the latest one: it pops up once for every
// visitor ("UPDATE N") on their next page load. Older updates never pop up again.
const UPDATES = [
  {
    n: 1,
    date: '2026-11-06',
    title: 'Your player, bigger payouts, patch notes',
    items: [
      'Your player: the commissioner can link your account to your real MFL player. Every win pays 50,000 coins, plus coins for your stats: 125,000 per TD you score, 75,000 per TD pass, 50,000 per interception, 25,000 per pass breakup, notable catch or notable play, minus 25,000 per interception you throw or penalty you get. Past games count, and a popup shows what you earned after every game.',
      'Lineup players pay way more: 250 coins per fantasy point.',
      'Pack prices are up 1.5× to 2× (the most on the top packs) now that coins come easier.',
      'New page: every way to earn coins. Find it as Earn coins in the News menu and at the bottom of every page.',
      "New: these patch notes, and a popup like this one whenever there's an update.",
      'Fair play: every pick on the Nov 6 game was voided and interception picks are off, after players threw interceptions on purpose.',
    ],
  },
  {
    n: 2,
    date: '2026-11-07',
    title: 'Coin history on every profile',
    items: [
      "Every profile now shows where that account's coins came from (Pick'em, Lineup, Arcade, packs and the rest) and a coin history: every change, newest first, with the balance after it.",
      'Nov 6 rollback: coins handed out from the admin panel on Nov 6 were removed, and every pack, pick, card sale, trade and Lineup change made after 10:55 AM that day was undone, site wide. Coins spent on those packs and picks came back. If your Lineup changed back, set it again before the next game.',
      'The admin password was reset and every admin login was signed out.',
    ],
  },
  {
    n: 3,
    date: '2026-11-07',
    title: 'Lineup pays 100 coins a point',
    items: [
      'Lineup players now pay 100 coins per fantasy point instead of 250. It counts for every past game too, so Lineup coins from earlier games went down to match.',
    ],
  },
  {
    n: 4,
    date: '2026-11-07',
    title: 'New pack prices, score panel',
    items: [
      'Pack prices now match how many coins are going around: a Lineup earns most players 30,000 to 40,000 coins a game, so a 1,000-coin pack was pocket change. Most packs cost 10 times what they did (Standard 10,000). The Rookie Rack and Snack Attack Single are 1,000, so a brand-new account can still buy one. The chase packs are 150,000 to 400,000 (Dark Matter 400,000). Packs you already bought keep the price you paid.',
      'Score panel: the commissioner can let people score games. Scorers get a Score link in the menu to enter results, plays and who didn\'t play, and every save is logged with their name.',
      'The admin panel now needs a PIN as well as the password.',
    ],
  },
  {
    n: 5,
    date: '2026-11-07',
    title: 'Season 1: Full Extension',
    items: [
      'Season 1 is here: Full Extension, with Carson Tabaka (#23, BigBoyCT) on the cover. See everything on the new Season 1 page (Cards, then Packs or My Cards, or go to /season).',
      'Nine new cards for every player, all named for Carson: T-Time, Twenty-Three, Cars, Team Chemistry, One-Hand CT, Tabaka Grab, Big Boy Mode, Cover Shoot 1/1 and Full Extension 1/1. Each one beats the older cards of its rarity.',
      "Carson's own two: the Cover Athlete card and the BigBoyCT 1/1, worth 6x fantasy points with every skill maxed.",
      'A new top rarity, Zenith, above Dark Matter: 5x points, every skill maxed and perk level 7. Every Zenith is a 1 of 1.',
      "Season 1 packs, from the free Season 1: Carson Tabaka - Welcome Pack (two free cards for everyone) through Season 1: Carson Tabaka, T-Time, Momma P's Cookies, CT Team Chemistry, Carson Charles Tabaka and BigBoyCT, up to Tabaka Time and Carson's Filet Dinner, the best pack in the shop and a coin flip for a Zenith. Season 1 cards only come from Season 1 packs.",
      'The Cover Athlete Pack: only cover athletes\' cards, starting with Carson. It stays in the shop for good, and every new season adds its cover athlete.',
    ],
  },
  {
    n: 6,
    date: '2026-11-07',
    title: 'Full Extension Essentials',
    items: [
      'New Season 1 pack: Full Extension Essentials - CT. 6 Season 1 cards with a Legend or better guaranteed, for 90,000 coins.',
    ],
  },
  {
    n: 7,
    date: '2026-11-07',
    title: 'Bigger packs, pack boxes',
    items: [
      'Every pack has more cards now: at least 3 and up to 15 (Standard 5, Premium 8, Mega 15, the free Daily Pack 3). Same prices.',
      'Chase packs like Dark Matter, The GOAT Hunt and Carson\'s Filet Dinner got extra cards too. The big chance is still on one card, the hit, and it is always the last one you flip.',
      'Pack boxes: buy 5, 10 or 20 of the same pack for 5%, 10% or 15% off. They open back to back: flip the pack, press Next for the next one, and see the whole box at the end.',
    ],
  },
  {
    n: 8,
    date: '2026-11-07',
    title: 'Play defense in 3D Blitz',
    items: [
      "Key defensive plays: 2 to 4 times a game the CPU's biggest snaps are played live instead of simulated (3rd and 4th downs, the red zone, the two-minute drill, a one-score game late).",
      'You call a real defense (Cover 2, Cover 3, Cover 4, Man, Man Blitz, Zone Blitz, All-Out Blitz, Disguise, Prevent, Press Man, QB Spy, Stack the Box), then play a defender yourself: arrows or drag to move, SHIFT to sprint, SPACE to jump for the ball, X to dive at a runner or a pass, Q to switch to the defender nearest the ball. Leave the stick alone and he plays his assignment.',
      'The CPU runs a real play against you: its quarterback reads the field and throws to the open man, scrambles or throws it away, and its runners juke and spin. A stop, a sack or a pick goes straight back into the drive.',
      'Your defenders are your own Lineup players, and a defender you steer reads the ball better than the AI: time your jump and the pick is yours.',
      'Head to Head: on defense you now play a defender live too, with the same buttons, on top of calling the play.',
    ],
  },
  {
    n: 9,
    date: '2026-11-07',
    title: 'Skill over luck',
    items: [
      "More live defense: 2 to 4 of every CPU drive's snaps are played live now (3rd and 4th downs, the red zone and the two-minute drill always).",
      'A defensive playbook at the bottom of the screen, just like the offense: tabs (Suggested, Zone, Man, Blitz, Special) and play art for every call, showing where everyone lines up, the zones, the man assignments and the blitzers. Same in Head to Head.',
      "Your call decides the simulated snaps too: each one is the CPU's kind of play (run, quick pass, deep shot, screen, play-action...) against your call. Cover 4 shuts down deep shots but gives up runs, Stack the Box stuffs runs but play-action burns it, and so on. Keep making the same call and they start running what beats it. The drive card shows what they ran.",
      'Jukes, spins, stiff arms and hurdles are timed now, not rolled: hit the move just before the tackler gets there for a PERFECT move that beats him for sure. Too early and he adjusts, too late and the hit is on.',
      'Catches, picks and breakups are decided by where the ball is thrown and who is open, not by dice: a good ball to an open receiver is caught, a ball on the defender\'s side can be picked. Throws go where you aim them; on the run they drift the way you are moving, and with a man in your face they sail.',
    ],
  },
  {
    n: 10,
    date: '2026-11-07',
    title: 'Season 1 card names',
    items: [
      "The Season 1 cards are named after the Season 1 packs now: Tabaka Welcome, T-Time, Momma P's Cookies, Full Extension Essentials, CT Team Chemistry, Carson Charles Tabaka, Tabaka Time, Season 1: Carson Tabaka 1/1 and Carson's Filet Dinner 1/1, plus Carson's own Cover Athlete and BigBoyCT 1/1. Cards you already have keep everything but the old name.",
      'Every Season 1 card now says SEASON 1 near the bottom, in the Season 1 lettering.',
    ],
  },
  {
    n: 11,
    date: '2026-11-07',
    title: 'Every card has its own overall',
    items: [
      "Every card now has its own overall (OVR), the big number on the front, and it's the number that says how good the card is. The better the card, the higher it is: one player's Base card might be a 79 and the same player's Zenith a 98. Better players are higher at every rarity, and Season 1 cards and 1 of 1s beat the other cards of their rarity.",
      'Card fronts are cleaner: just the overall, the name, the card, its perk and its rarity. The multiplier and the rating changes moved to the back (tap ↻ to flip any card, now on the Season page too).',
      'In the Arcade, a card plays at its overall: a 95 card plays like a 95 in 3D Blitz, Modern Bowl and Career. The back shows every rating the card plays at.',
      'My Cards, the Lineup picker, auto-pick and collections all sort by overall now, best first.',
    ],
  },
  {
    n: 12,
    date: '2026-11-07',
    title: '3D Blitz: returns get tackled, clutch defense',
    items: [
      "Interception and fumble returns: the other team tackles you when they get to you now. Before, they could be right on you and not even try.",
      'Clutch time and goal-line stands: in the last minute of a one-score 4th quarter or in overtime, and whenever the CPU is inside your 10, you play every defensive snap yourself (CLUTCH D and GOAL LINE STAND).',
    ],
  },
  {
    n: 13,
    date: '2026-11-07',
    title: '3D Blitz: the realism update',
    items: [
      'Smarter defense: safeties stay over the top, corners turn and run with deep routes, defenders read the quarterback and break on the throw, and they play deep balls at the highest point. Linebackers carry seams and wall off crossers, and tacklers take real pursuit angles.',
      'The line: the pocket forms and collapses, pass rushers win with bull rushes, speed rushes, swims and rips, and run plays have pulling guards and double teams. Running backs read the hole and cut back.',
      'Routes: receivers slow into their breaks and drive out of them, and when the QB scrambles they work back to him.',
      "Throws and catches: arm strength sets how fast the ball gets there, and accuracy depends on the QB's accuracy and his feet (set, on the run, under pressure). Receivers catch at the chest, high-point it, catch over the shoulder or lay out, and good hands matter. Breakups are real swats, and most picks come from bad throws.",
      'Physics: players build up speed, hard cuts cost speed, tackles depend on momentum and angle, runners keep their forward progress, and falls look real.',
      'All-new animations: running with no sliding feet, backpedals, jukes, spins, stiff arms and hurdles, a real throwing motion, hands catches, diving catches, wrap-up tackles and linemen fighting hands.',
      'Great cards play great: 90+ players are faster, stronger and shiftier, and 95+ cards get a 3D Blitz ability for their spot (Pocket Presence, Freight Train, Ankle Breaker, Deep Tracker, Brick Wall). Your players wear their OVR in the game, superstar plays get a callout, and the game shows your Lineup overall against the other team before kickoff. Card backs show the ability.',
      'Live defense: your AI teammates read and react like a top defense at every difficulty, so getting a stop is more up to you.',
    ],
  },
  {
    n: 14,
    date: '2026-11-07',
    title: '3D Blitz: drive plans and a defender who matters',
    items: [
      'On defense, the guy you play makes plays: press JUMP or DIVE with the ball in the air and he goes after it with a much bigger reach. Get a hand on it and it is at least a breakup, and a clean one is often a pick. A dive at the ball carrier is a real tackle.',
      "Drive plans: when they get the ball you pick a plan for the whole drive instead of one play: Bend Don't Break, Bring the Heat, Lockdown, Run Wall, Ball Hawk or Mix It Up. Every snap runs the call from your plan that fits the down, and key plays open on your plan's calls.",
      'Simulated drives play out on a little field on the drive card: the ball, the line to gain, each play and the call it ran against. It takes no longer than before.',
      'You can see the down on defense: the scoreboard shows their down and distance and where the ball is.',
      'Stadium pulse on kicks: the place gets loud for your field goals and extra points (louder for long ones and late in a close game), and a loud crowd makes the kick meter harder. Kickoffs and punts get the crowd going too.',
    ],
  },
  {
    n: 15,
    date: '2026-11-07',
    title: '3D Blitz: shorter games, you pick how much defense',
    items: [
      'Pick how much defense you play live on the 3D Blitz setup screen: None (their drives are simulated), Quick (clutch time and goal-line stands), Medium (1-2 snaps a drive plus those, the new default), High (2-4 a drive, how it was) or Full (every snap). It remembers your pick.',
      'Live defensive snaps are quicker: the snap comes 1.5 seconds after you line up (was 3.4), and the next play comes 1.5 seconds after the whistle (was 2.5).',
      'Running clock on defense: after a play that ends in bounds, the clock keeps running while you call the next one, the same as on offense. Call a timeout to stop it (the T/O button on the call card, or T).',
      'Three timeouts a half instead of two.',
      "Games are a lot shorter: in our test games Medium ran about a third shorter than before, and Quick or None are back near the old length.",
    ],
  },
  {
    n: 16,
    date: '2026-11-07',
    title: '3D Blitz: the defense fights back',
    items: [
      "The go route can't be thrown every play anymore. The CPU remembers your deep shots, whatever play you call or hot route you use. Go deep a few times and they switch to two deep safeties, the corners back off and stay on top, and a safety rides over the receiver you keep going to. You'll see THEY'RE SITTING DEEP when it happens. Then the short stuff is open, and going underneath cools them off.",
      'Contested deep balls are harder to come down with, the longer the throw the harder, and more of them get picked or broken up.',
      "If you catch it with a defender right on you, you're usually going down. The catch costs you speed (most of all on a leaping grab), you can't juke or spin for a split second while you tuck it away, and the defender on you drives right through the catch. Defenders near you no longer freeze when you catch it.",
      "A juke fakes out the defender it's aimed at, not everyone around you. Anyone you didn't fool can still tackle you mid-cut, a second defender only bites on a perfect juke by a clearly quicker runner, and a juke is now a sharp cut that costs a little speed instead of a burst.",
      'The defender who loses a jump ball only gets knocked down on a real highlight catch, where you both went up and you had no business winning it. Otherwise that defender is right there to tackle you.',
      "Interception returns: everyone chases you now, the quarterback and the linemen too, and they tackle like defenders even at the easy levels. Fewer pick-sixes from nobody touching you.",
      "On defense, the moment the ball is thrown you're switched to the defender covering the receiver it's going to.",
      'The start screen has a Defense slider (None to Full) instead of the instructions. The voice commentary checkbox is gone: commentary is on by default.',
      'New gear button in the game: change how much defense you play, and turn sound and voice commentary on or off.',
    ],
  },
  {
    n: 17,
    date: '2026-11-07',
    title: '3D Blitz: no more slow motion',
    items: [
      "The game never slows down anymore. It used to drop into slow motion whenever a rusher grabbed your quarterback. Now you still get a split second to get the throw off, but in real time, and the window is a little longer to make up for it.",
      'The Slow-Mo card perk no longer slows the whole game: it slows every defender near the player instead.',
      'Instant replays play at normal speed (they were half speed).',
      "On a slow device, a frame that takes too long now catches up instead of playing in slow motion.",
    ],
  },
  {
    n: 18,
    date: '2026-11-07',
    title: '3D Blitz: no more wide-open receivers',
    items: [
      "Fixed receivers being left wide open with nobody near them. In zone coverage, each corner and outside linebacker had a zone on a fixed side of the field. When a play was flipped, both corners ran across the field at the snap and left the outside receivers alone. Now everyone covers the zone on their own side. In our tests, a receiver alone with 7+ yards of space went from about 1 in 4 pass plays to about 1 in 20.",
      'Same fix for a disguised Cover 3: the strong safety now lines up on the tight end\'s side instead of always on the right, so the flat on the other side isn\'t left open.',
      'This also fixes your own defense on live snaps and in Head to Head, which had the same problem.',
    ],
  },
  {
    n: 19,
    date: '2026-11-08',
    title: '3D Blitz: the switch on the throw keeps him running',
    items: [
      "When you're switched to the defender covering the receiver the ball is thrown to, he keeps running the way he was going, after the ball, instead of stopping or following the direction you were already holding for your old player. Move the stick somewhere new, let go and press again, or jump or dive, and he's yours.",
    ],
  },
  {
    n: 20,
    date: '2026-11-08',
    title: 'Coin history: runs say what really happened',
    items: [
      "Double or Nothing and Double or Double games now say what happened in your coin history. A game you won with the cash-out still waiting says \"win · cash out … waiting on the 3D Blitz page\", a game you won and played on says so, and a game with no result yet says \"in progress\". Before, all of these showed as a loss because their coins were negative: a run's win pays nothing until you cash out, and playing on puts more at risk.",
    ],
  },
  {
    n: 21,
    date: '2026-11-08',
    title: '3D Blitz: kickoff coverage has safeties',
    items: [
      "Kickoff returns for a touchdown are rare now. The kicking team keeps two safeties back behind the wave of tacklers as the last line. They stay in front of the returner and come up to make the tackle once the returner gets close. Before, the slow kicker was the only one back, so a fast returner who got through the first wave usually scored.",
      'Great returners still get good field position: about 31 yards a return with a top lineup in our tests, against about 24 for an average one. Touchdowns went from about 1 in 7 kickoffs (Rookie, top lineup) to about 1 in 100.',
    ],
  },
  {
    n: 22,
    date: '2026-11-08',
    title: '3D Blitz: play at Metcalf',
    items: [
      "New on the 3D Blitz setup screen: Where. Play at The Stadium like before, or at Metcalf: the real blacktop at Thomas Metcalf School, rebuilt life size from measurements, aerial photos and pictures of the school.",
      "Every painted mark is where it really is: the field lines and red goal lines, the red ticks, the white box with its corner squares, the three four-square courts, the hopscotch, the target, both basketball keys with their hoops, and all 17 Wildcats paw prints, worn the way the real paint is.",
      "Around it: the brick wing, the red shed, the blue two-story wing and the hedge, the roofs and skylights, the black fence and brick pillars on Main Street, the streetlights, the Wittenberg Lutheran Center across the street, the parking lot with its arrows, the new playground and the trees. Lunch-time sun and schoolyard sounds instead of a stadium crowd at night.",
      "It plays on the real field: about 30 yards goal line to goal line, 2-yard end zones and 24 yards wide, 11 on 11. Formations, routes, coverage, the play art and the cameras are fitted to it.",
      "Metcalf house rules: throw-offs instead of kickoffs, no punting, no field goals, a touchdown is worth 7 (no extra point), and you go for it on 4th down. First downs are still 10 yards. A pick or fumble downed in your own end zone is a touchback at your 4, and a runner who falls over the goal line scores.",
      "Metcalf games pay the same as the stadium. Double or Nothing, Double or Double, Head to Head and Career are played at the stadium for now.",
      "Small fixes in every game: \"Your ball at your 3\" instead of \"at the your 3\", the CPU drive card's result fits on one line, and after a score the bottom line says whose ball is next.",
    ],
  },
  {
    n: 23,
    date: '2026-11-08',
    title: 'Admin panel on all your devices',
    items: [
      "Log in to the admin panel once while signed in to your account and it shows up on every device signed in to that account. Each device still asks for the 4-digit admin PIN before the panel opens.",
      'Logging out of the admin panel takes it off all of that account\'s devices.',
    ],
  },
  {
    n: 24,
    date: '2026-11-08',
    title: '3D Blitz: Metcalf for real, crowds, weather, tougher defense',
    items: [
      "Metcalf fixes from your list: the field is now just the real football field (the west one, with the red yard ticks on both sidelines), the fence between the blacktop and the parking lot is the real black fence, and everything north and south of the blacktop was rebuilt from the aerial photos: the big grass field with its curved path, the pads, the trees, College Ave, the real campus buildings, the parking lots with real cars, and a flat-town skyline instead of hills. Things that aren't really there were removed.",
      "At Metcalf nobody wears helmets or uniforms: everyone plays in a plain T-shirt in their team's color, with their own sweats, joggers or shorts, sneakers, and real hair and faces.",
      "Cars, buses and trucks drive by on Main Street and College Ave, with engine and tire sounds. People walk by on the sidewalks.",
      "Throw the ball over a fence at Metcalf and everyone lines up at the fence yelling for someone walking by to get it; they toss it back and the game goes on. Skip it after 3 seconds.",
      "New Metcalf settings: Crowd (a ton of people all around the field and across the blacktop and playground, cheering like a real stadium crowd, with the pulse to match), Big field (the whole map scaled up so the field is a full 100-yard field) and Two-hand touch (two hands on the ball carrier ends the play, no tackles; Dive becomes Touch on defense).",
      "On the true-size Metcalf field there are no first downs: you get four downs to score from wherever the drive starts. The big field has normal 10-yard first downs.",
      "Double or Nothing and Double or Double can be played at Metcalf now, always with the crowd and the big field on and tackle football.",
      "Pick the time of day (morning, noon, sunset, night) and the weather (sunny, partly cloudy, overcast, rain, thunderstorm, snow, fog) in every mode, at both venues. Snow covers the grass and roofs, rain makes everything wet, storms have lightning and thunder, and Metcalf at night has its real streetlights.",
      "Catching it short and sprinting no longer outruns the whole defense: after a catch every defender runs to the ball, takes an angle to cut you off, breaks down in front of you and can arm-tackle you. Jukes, cutbacks and great cards still break big plays.",
      "Deep balls into tight or double coverage are now the hardest throw in the game: defenders find the ball and play it, and two defenders on it usually means broken up or picked. To win one you need the ball put away from the defender AND a well-timed jump; a bad jump says so (JUMPED TOO SOON / TOO LATE / NO JUMP). The CPU's quarterback stops forcing deep balls too.",
      "Onside kicks are much harder (a perfect tap works about 1 in 3 at Rookie and 1 in 7 at the top level) and the onside bar now has the green in the middle with a TAP! prompt and a PERFECT/GOOD/OK/MISS flash. CPU onside kicks land at realistic rates.",
    ],
  },
  {
    n: 25,
    date: '2026-11-09',
    title: 'Metcalf: 7 on 7, 7 banana, one clock',
    items: [
      "Metcalf is 7 on 7 now: your QB, RB, WR1-3, TE and OL1 (the center) play, and the defense has one lineman, two linebackers, two corners and two safeties. Metcalf has its own playbook for it, and the Lineup page marks which spots play at Metcalf.",
      "No rushing the QB at Metcalf until 7 banana (4.75 seconds). The count fills in at the top of the screen, then RUSH!",
      "Metcalf plays one 8-minute clock (no quarters, no halftime). When time runs out, the team with the ball gets one last play, then the game is over.",
      "At Metcalf every red dash on the side of the field is 5 yards, so spots, distances, gains and the box score read like a 100-yard field.",
      "The CPU offense at Metcalf actually scores now, more often the higher the level.",
      "Players at Metcalf are drawn at their real listed heights (they were too tall), and the black fences are chin-high like the real ones.",
      "The big Metcalf field is a true zoom of the real place: the playground, buildings, trees, hoops and cars scale up with the field instead of looking mini.",
      "A packed crowd on the big field (rows several deep all the way around, about 1,800 fans), and more fans on the true-size field. With the crowd on, Metcalf is loud: almost as loud as the stadium. Fans behind the goal lines no longer look like they're walking in place.",
      "Double or Nothing and Double or Double at Metcalf: pick the true-size or the big field and two-hand touch if you want. The crowd is always on.",
    ],
  },
  {
    n: 26,
    date: '2026-11-09',
    title: 'Metcalf: a real CPU, and change the setup between run games',
    items: [
      "Double or Nothing and Double or Double: after each win you can change the next game's setup right on the win screen: where you play (The Stadium or Metcalf), the big field and two-hand touch at Metcalf, the time of day and the weather. It starts from your last game's choices; the crowd is always on at Metcalf in a run.",
      "The CPU offense at Metcalf is a lot better: its quarterback sees the defender you're controlling and goes elsewhere, checks down or throws it away instead of forcing it, and throws more accurately. On defense you'll get picks far less often (they were coming almost every drive); a hand on the ball is usually a breakup now.",
      "The CPU defense at Metcalf covers deep for real: deep balls on the small field get the full deep-coverage rules (counted in the yards you see, 5 per dash), and since nobody rushes before 7 banana, coverage tightens the longer you hold the ball.",
    ],
  },
  {
    n: 27,
    date: '2026-11-09',
    title: 'Metcalf: real defense, close games',
    items: [
      "Metcalf: the CPU defense covers much tighter. No free hitches against soft zones, the running back is covered, corners line up closer, deep safeties come down on short routes, and defenders break on the ball sooner. Runs and catches get swarmed with better angles and surer tackles.",
      "The Metcalf CPU defense learns what you run: deep shots get two deep safeties, quick throws get press man, holding the ball gets a blitz on 7 banana, and a lot of runs gets a stacked box.",
      "Close games at Metcalf: the comeback logic works there now. Whoever is behind gets a lift that grows late in the game, and a big lead gets harder to keep, so games stay closer and swing more.",
      "The CPU offense at Metcalf picks plays that beat the defense you called and gets more aggressive late when it's behind.",
      "Fixed: a harder level was making your own defenders better at interceptions on Metcalf key plays. Now the harder level helps the CPU, not you.",
    ],
  },
  {
    n: 28,
    date: '2026-11-09',
    title: '3D Blitz: real faces at Metcalf',
    items: [
      "Every league player now has their own 3D head at Metcalf, made from their player photo: the real face on the player in the game. (At the stadium everyone still wears a helmet.)",
      "The Metcalf CPU defense is eased a lot: it was smothering every throw. Corners play off more, coverage only tightens late in a play, and it wins fewer jump balls.",
    ],
  },
  {
    n: 29,
    date: '2026-11-09',
    title: 'Metcalf: old defense back, tougher CPU offense',
    items: [
      "Metcalf: the old CPU defense is back (the newer one smothered everything); it just plays deep balls smarter: deep defenders stay with the receiver, find the ball sooner and close on it.",
      "The CPU offense at Metcalf is a lot better: sharper, more accurate quarterback and quicker receivers and backs.",
      "The Metcalf crowd stands still now: no more stepping in place or rushing in after a touchdown.",
    ],
  },
  {
    n: 30,
    date: '2026-11-09',
    title: 'Injured reserve',
    items: [
      "Injured reserve: the admin can put a player on IR (with the injury and an expected return date). He gets a red IR badge on the rosters, his player page shows the injury, Pick'em has no props on him, and he's marked as not playing when a game is scored.",
    ],
  },
];

const latest = () => UPDATES.reduce((a, u) => (!a || u.n > a.n ? u : a), null);

module.exports = { UPDATES, latest };

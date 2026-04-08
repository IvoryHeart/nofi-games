import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Constants ───────────────────────────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const PANEL_COLOR = '#FFFAF5';
const PRIMARY_COLOR = '#8B5E83';
const ACCENT_COLOR = '#D4A574';
const TILE_COLOR = '#F5E6D8';
const TILE_SELECTED_COLOR = '#E8C497';
const TEXT_DARK = '#3D2B35';
const TEXT_LIGHT = '#FFFFFF';
const TEXT_MUTED = '#8B7D6B';
const SUCCESS_COLOR = '#4FA56B';
const ERROR_COLOR = '#E85D5D';
const BUTTON_COLOR = '#8B5E83';
const BUTTON_TEXT = '#FFFFFF';
const BORDER_COLOR = '#D9CFC6';

// Curated pangram bases. Each base is a real word whose letters form
// many common English sub-words. Picked so 5/6/7 letter slices all work.
const ANAGRAM_BASES: string[] = [
  'GARDEN',  // 6
  'LIBRARY', // 7
  'ORANGE',  // 6
  'PLANET',  // 6
  'STREAM',  // 6
  'CASTLE',  // 6
  'FOREST',  // 6
  'MASTER',  // 6
  'PARENT',  // 6
  'DANGER',  // 6
  'KITCHEN', // 7
  'TEACHER', // 7
  'PICTURE', // 7
  'STRANGE', // 7
  'CARPETS', // 7
  'PARTNER', // 7
  'CLEANER', // 7
  'GROWING', // 7
  'PAINTER', // 7
  'BRACKET', // 7
  'WRITERS', // 7
  'STORIES', // 7
  'HEARTS',  // 6
  'WONDER',  // 6
  'ANSWER',  // 6
  'PRINCE',  // 6
  'SILVER',  // 6
  'WINTER',  // 6
  'NUMBER',  // 6
  'MOTHER',  // 6
  'FATHER',  // 6
  'SISTER',  // 6
  'BROTHER', // 7
  'FRIENDS', // 7
  'HEALTH',  // 6
  'PLATES',  // 6
];

// Curated common-word dictionary. ~500 words, length 3-7. Tuned so the
// pangram bases above each yield a healthy crop of sub-words.
const DICTIONARY_WORDS: string[] = [
  // 3-letter words
  'ace', 'act', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'ale', 'all', 'and',
  'ant', 'any', 'ape', 'apt', 'arc', 'are', 'ark', 'arm', 'art', 'ash', 'ask',
  'ate', 'bad', 'bag', 'ban', 'bar', 'bat', 'bay', 'bed', 'bee', 'beg', 'bet',
  'bid', 'big', 'bin', 'bit', 'box', 'boy', 'bra', 'bro', 'bug', 'bun', 'bus',
  'but', 'buy', 'bye', 'cab', 'can', 'cap', 'car', 'cat', 'cog', 'con', 'cop',
  'cot', 'cow', 'cry', 'cub', 'cup', 'cut', 'dab', 'dad', 'dam', 'day', 'den',
  'dig', 'dim', 'dip', 'doe', 'dog', 'dot', 'dry', 'dug', 'ear', 'eat', 'ebb',
  'eel', 'egg', 'ego', 'elf', 'elk', 'elm', 'end', 'era', 'eve', 'eye', 'fan',
  'far', 'fat', 'fed', 'fee', 'few', 'fib', 'fig', 'fin', 'fir', 'fit', 'fix',
  'fly', 'fog', 'for', 'fox', 'fro', 'fry', 'fun', 'fur', 'gag', 'gap', 'gas',
  'gel', 'gem', 'get', 'gig', 'gin', 'god', 'got', 'gum', 'gun', 'gut', 'guy',
  'had', 'has', 'hat', 'hay', 'hen', 'her', 'hew', 'hex', 'hid', 'him', 'hip',
  'his', 'hit', 'hob', 'hoe', 'hog', 'hop', 'hot', 'how', 'hub', 'hug', 'hum',
  'hut', 'ice', 'ill', 'imp', 'ink', 'inn', 'ion', 'ire', 'its', 'jab', 'jam',
  'jar', 'jaw', 'jay', 'jet', 'jig', 'job', 'jog', 'jot', 'joy', 'jug', 'keg',
  'key', 'kid', 'kin', 'kit', 'lab', 'lad', 'lag', 'lap', 'law', 'lay', 'led',
  'lee', 'leg', 'let', 'lid', 'lie', 'lip', 'lit', 'log', 'lot', 'low', 'mad',
  'man', 'map', 'mar', 'mat', 'may', 'men', 'met', 'mid', 'mix', 'mob', 'mom',
  'moo', 'mop', 'mud', 'mug', 'nab', 'nag', 'nap', 'nay', 'net', 'new', 'nip',
  'nod', 'nor', 'not', 'now', 'nub', 'nut', 'oak', 'oar', 'oat', 'odd', 'ode',
  'off', 'oft', 'oil', 'old', 'one', 'orb', 'ore', 'ouch', 'our', 'out', 'owe',
  'owl', 'own', 'pad', 'pal', 'pan', 'par', 'pat', 'paw', 'pay', 'pea', 'pen',
  'pep', 'per', 'pet', 'pew', 'pie', 'pig', 'pin', 'pit', 'ply', 'pod', 'pop',
  'pot', 'pro', 'pry', 'pub', 'pug', 'pun', 'pup', 'put', 'rag', 'ram', 'ran',
  'rap', 'rat', 'raw', 'ray', 'red', 'rep', 'rib', 'rid', 'rig', 'rim', 'rip',
  'rob', 'rod', 'roe', 'rot', 'row', 'rub', 'rue', 'rug', 'rum', 'run', 'rut',
  'rye', 'sac', 'sad', 'sag', 'sap', 'sat', 'saw', 'say', 'sea', 'see', 'set',
  'sew', 'she', 'shy', 'sin', 'sip', 'sir', 'sit', 'six', 'ski', 'sky', 'sly',
  'sob', 'son', 'sow', 'soy', 'spa', 'spy', 'sue', 'sum', 'sun', 'tab', 'tad',
  'tag', 'tan', 'tap', 'tar', 'tax', 'tea', 'ten', 'the', 'tic', 'tie', 'tin',
  'tip', 'toe', 'ton', 'too', 'top', 'tot', 'tow', 'toy', 'try', 'tub', 'tug',
  'urn', 'use', 'van', 'vat', 'vet', 'vex', 'via', 'vie', 'vow', 'wad', 'wag',
  'war', 'was', 'wax', 'way', 'web', 'wed', 'wee', 'wet', 'who', 'why', 'wig',
  'win', 'wit', 'woe', 'won', 'woo', 'yak', 'yam', 'yap', 'yes', 'yet', 'you',
  'zap', 'zip', 'zoo',

  // 4-letter words
  'able', 'acre', 'aged', 'ages', 'aide', 'aids', 'aims', 'airs', 'akin', 'alas',
  'ales', 'alit', 'ally', 'alms', 'also', 'amid', 'ance', 'andy', 'ankh', 'ante',
  'ants', 'apes', 'arch', 'arcs', 'area', 'arks', 'arms', 'army', 'arts', 'ashy',
  'asks', 'atop', 'aunt', 'auto', 'avid', 'away', 'awed', 'axle', 'baby', 'back',
  'bade', 'bags', 'bait', 'bake', 'bald', 'bale', 'ball', 'band', 'bane', 'bang',
  'bank', 'bans', 'bard', 'bare', 'barf', 'bark', 'barn', 'bars', 'base', 'bash',
  'bask', 'bath', 'bats', 'bays', 'bead', 'beak', 'beam', 'bean', 'bear', 'beat',
  'beds', 'bees', 'beef', 'been', 'beep', 'beer', 'bees', 'begs', 'bell', 'belt',
  'bend', 'bent', 'best', 'bets', 'bias', 'bids', 'bike', 'bile', 'bill', 'bind',
  'bins', 'bird', 'bite', 'bits', 'blab', 'blah', 'blew', 'blip', 'blob', 'blot',
  'blow', 'blue', 'blur', 'boar', 'boat', 'body', 'bogs', 'boil', 'bold', 'bole',
  'boll', 'bolt', 'bomb', 'bond', 'bone', 'bong', 'bony', 'book', 'boom', 'boon',
  'boor', 'boot', 'bops', 'bore', 'born', 'boss', 'both', 'bout', 'bowl', 'bows',
  'boys', 'brag', 'bran', 'brat', 'bray', 'brew', 'brim', 'brow', 'buck', 'buds',
  'buff', 'bugs', 'bulb', 'bulk', 'bull', 'bump', 'bums', 'buns', 'buoy', 'burl',
  'burn', 'burp', 'burr', 'bury', 'bush', 'busk', 'bust', 'busy', 'butt', 'buys',
  'buzz', 'byte', 'cabs', 'cafe', 'cage', 'cake', 'calf', 'call', 'calm', 'came',
  'camp', 'cane', 'cans', 'cant', 'cape', 'caps', 'card', 'care', 'cark', 'carp',
  'cars', 'cart', 'case', 'cash', 'cask', 'cast', 'cate', 'cats', 'cave', 'cell',
  'cent', 'chap', 'char', 'chat', 'chef', 'chew', 'chic', 'chin', 'chip', 'chop',
  'chow', 'chub', 'chug', 'chum', 'cite', 'city', 'clad', 'clam', 'clan', 'clap',
  'claw', 'clay', 'clef', 'clip', 'clod', 'clog', 'clop', 'club', 'clue', 'coal',
  'coat', 'coax', 'cock', 'coda', 'code', 'cods', 'cogs', 'coil', 'coin', 'cold',
  'cole', 'cone', 'conk', 'cons', 'cook', 'cool', 'coon', 'coop', 'coos', 'cope',
  'cops', 'copy', 'cord', 'core', 'cork', 'corn', 'cost', 'cosy', 'cots', 'coup',
  'cove', 'cowl', 'cows', 'crab', 'crag', 'cram', 'crap', 'craw', 'crew', 'crib',
  'crop', 'crow', 'crud', 'cube', 'cubs', 'cued', 'cues', 'cuff', 'cull', 'cult',
  'cups', 'curb', 'cure', 'curl', 'curt', 'cusp', 'cuss', 'cute', 'cuts', 'czar',
  'dabs', 'dads', 'dads', 'daft', 'dais', 'dale', 'dame', 'damn', 'damp', 'dams',
  'dare', 'dark', 'darn', 'dart', 'dash', 'data', 'date', 'dawn', 'days', 'daze',
  'dead', 'deaf', 'deal', 'dean', 'dear', 'debt', 'deck', 'deed', 'deem', 'deep',
  'deer', 'deft', 'defy', 'dell', 'dens', 'dent', 'deny', 'desk', 'dial', 'dice',
  'died', 'dies', 'diet', 'digs', 'dill', 'dime', 'dine', 'ding', 'dint', 'dips',
  'dire', 'dirt', 'disc', 'dish', 'disk', 'dive', 'dock', 'does', 'doff', 'dogs',
  'dole', 'doll', 'dolt', 'dome', 'done', 'dons', 'doom', 'door', 'dope', 'dose',
  'dots', 'dote', 'doug', 'dour', 'dove', 'down', 'doze', 'drab', 'drag', 'drat',
  'draw', 'dray', 'dreg', 'drew', 'drip', 'drop', 'drub', 'drug', 'drum', 'dual',
  'duck', 'duct', 'dude', 'duds', 'duel', 'dues', 'duet', 'duff', 'dugs', 'duke',
  'dull', 'duly', 'dumb', 'dump', 'dune', 'dung', 'dunk', 'duos', 'dupe', 'dusk',
  'dust', 'duty', 'dyad', 'dyed', 'dyer', 'dyes', 'each', 'earl', 'earn', 'ears',
  'ease', 'east', 'easy', 'eats', 'eave', 'ebbs', 'echo', 'edge', 'edgy', 'eels',
  'eggs', 'egos', 'eked', 'ekes', 'elks', 'ells', 'elms', 'else', 'emit', 'emus',
  'ends', 'envy', 'epic', 'eras', 'ergs', 'errs', 'even', 'ever', 'eves', 'evil',
  'ewer', 'exam', 'exes', 'exit', 'eyed', 'eyes', 'face', 'fact', 'fade', 'fads',
  'fail', 'fain', 'fair', 'fake', 'fall', 'fame', 'fang', 'fans', 'fare', 'farm',
  'fart', 'fast', 'fate', 'fats', 'faun', 'fawn', 'faze', 'fear', 'feat', 'feds',
  'feed', 'feel', 'fees', 'feet', 'fell', 'felt', 'fend', 'fens', 'fern', 'fest',
  'feta', 'feud', 'fiat', 'fibs', 'figs', 'file', 'fill', 'film', 'find', 'fine',
  'fink', 'fins', 'fire', 'firm', 'firs', 'fish', 'fist', 'fits', 'five', 'fizz',
  'flag', 'flak', 'flan', 'flap', 'flat', 'flaw', 'flax', 'flay', 'flea', 'fled',
  'flee', 'flew', 'flex', 'flip', 'flit', 'flog', 'flop', 'flow', 'flue', 'flux',
  'foal', 'foam', 'foes', 'fogs', 'fogy', 'foil', 'fold', 'folk', 'fond', 'font',
  'food', 'fool', 'foot', 'ford', 'fore', 'fork', 'form', 'fort', 'foul', 'four',
  'fowl', 'foxy', 'frat', 'fray', 'free', 'fret', 'frig', 'frog', 'from', 'fuel',
  'full', 'fume', 'fund', 'funk', 'furl', 'furs', 'fury', 'fuse', 'fuss', 'fuzz',
  'gabs', 'gads', 'gaff', 'gage', 'gags', 'gain', 'gait', 'gale', 'gall', 'game',
  'gang', 'gaps', 'garb', 'gash', 'gasp', 'gate', 'gave', 'gawk', 'gaze', 'gear',
  'geek', 'gels', 'gems', 'gene', 'gent', 'germ', 'gets', 'ghee', 'gibe', 'gift',
  'gigs', 'gild', 'gill', 'gilt', 'gins', 'girl', 'gist', 'give', 'glad', 'glee',
  'glen', 'glib', 'glob', 'glom', 'glow', 'glue', 'glum', 'glut', 'gnat', 'gnaw',
  'goad', 'goal', 'goat', 'gobs', 'gods', 'goes', 'gold', 'golf', 'gone', 'gong',
  'good', 'goof', 'goon', 'gore', 'gory', 'gosh', 'goth', 'gout', 'gown', 'grab',
  'grad', 'gram', 'gran', 'gray', 'grew', 'grey', 'grid', 'grim', 'grin', 'grip',
  'grit', 'grog', 'grow', 'grub', 'guff', 'gulf', 'gull', 'gulp', 'gums', 'gunk',
  'guns', 'guru', 'gush', 'gust', 'guts', 'guys', 'gyms', 'gyro', 'hack', 'haft',
  'hags', 'hail', 'hair', 'hake', 'hale', 'half', 'hall', 'halo', 'halt', 'hams',
  'hand', 'hang', 'hank', 'hard', 'hare', 'hark', 'harm', 'harp', 'hart', 'hash',
  'hasp', 'hate', 'hath', 'hats', 'haul', 'have', 'hawk', 'hays', 'haze', 'hazy',
  'head', 'heal', 'heap', 'hear', 'heat', 'heck', 'heed', 'heel', 'heft', 'heir',
  'held', 'hell', 'helm', 'help', 'hemp', 'hems', 'hens', 'herb', 'herd', 'here',
  'hero', 'hers', 'hewn', 'hews', 'hick', 'hide', 'high', 'hike', 'hill', 'hilt',
  'hind', 'hint', 'hips', 'hire', 'hiss', 'hits', 'hive', 'hoax', 'hobo', 'hobs',
  'hock', 'hoes', 'hogs', 'hold', 'hole', 'holy', 'home', 'hone', 'honk', 'hood',
  'hoof', 'hook', 'hoop', 'hoot', 'hope', 'hops', 'horn', 'hose', 'host', 'hour',
  'hove', 'howl', 'hubs', 'huff', 'huge', 'hugs', 'hula', 'hulk', 'hull', 'hump',
  'hums', 'hung', 'hunk', 'hunt', 'hurl', 'hurt', 'hush', 'husk', 'huts', 'hymn',
  'hype', 'iced', 'ices', 'icky', 'icon', 'idea', 'idle', 'idly', 'idol', 'iffy',
  'ills', 'imps', 'inch', 'inks', 'inky', 'inns', 'into', 'ions', 'iota', 'ires',
  'iris', 'irks', 'iron', 'isle', 'itch', 'item', 'jabs', 'jack', 'jade', 'jags',
  'jail', 'jamb', 'jams', 'jape', 'jars', 'java', 'jaws', 'jays', 'jazz', 'jeep',
  'jeer', 'jell', 'jerk', 'jest', 'jets', 'jibe', 'jiff', 'jigs', 'jilt', 'jive',
  'jobs', 'jock', 'jogs', 'john', 'join', 'joke', 'jolt', 'josh', 'joss', 'jots',
  'jowl', 'joys', 'judo', 'jugs', 'juju', 'juke', 'July', 'jump', 'June', 'junk',
  'jury', 'just', 'jute', 'juts', 'kale', 'kart', 'keel', 'keen', 'keep', 'kegs',
  'kelp', 'kens', 'kept', 'keys', 'khan', 'kick', 'kids', 'kiln', 'kilo', 'kilt',
  'kind', 'king', 'kink', 'kins', 'kiss', 'kite', 'kits', 'kiwi', 'knee', 'knew',
  'knit', 'knob', 'knot', 'know', 'koan', 'kohl', 'kook', 'labs', 'lace', 'lack',
  'lads', 'lady', 'lags', 'laid', 'lain', 'lair', 'lake', 'lamb', 'lame', 'lamp',
  'lams', 'land', 'lane', 'laps', 'lard', 'lark', 'lash', 'lass', 'last', 'late',
  'lath', 'laud', 'lava', 'lawn', 'laws', 'lays', 'laze', 'lazy', 'lead', 'leaf',
  'leak', 'lean', 'leap', 'leek', 'leer', 'lees', 'left', 'legs', 'leis', 'lend',
  'lens', 'lent', 'less', 'lest', 'lets', 'levy', 'liar', 'libs', 'lice', 'lick',
  'lids', 'lied', 'lien', 'lies', 'lieu', 'life', 'lift', 'like', 'lilt', 'lily',
  'limb', 'lime', 'limp', 'limy', 'line', 'link', 'lint', 'lion', 'lips', 'lira',
  'lire', 'lisp', 'list', 'lite', 'live', 'load', 'loaf', 'loam', 'loan', 'lobe',
  'lobs', 'lock', 'loft', 'logs', 'loin', 'loll', 'lone', 'long', 'look', 'loom',
  'loon', 'loop', 'loose', 'loot', 'lope', 'lops', 'lord', 'lore', 'lose', 'loss',
  'lost', 'lots', 'loud', 'lout', 'love', 'lows', 'luau', 'lube', 'luck', 'lucy',
  'luge', 'lugs', 'lull', 'lump', 'lung', 'lure', 'lurk', 'lush', 'lust', 'lute',
  'lynx', 'lyre',

  // 5-letter words
  'abide', 'abode', 'about', 'above', 'abuse', 'actor', 'acute', 'admit', 'adopt',
  'adult', 'after', 'again', 'agent', 'agree', 'ahead', 'aided', 'aides', 'aimed',
  'aimer', 'aired', 'alarm', 'alibi', 'alien', 'align', 'alike', 'alive', 'allay',
  'alley', 'allow', 'alloy', 'aloft', 'alone', 'along', 'aloof', 'aloud', 'alpha',
  'altar', 'alter', 'amass', 'amaze', 'amber', 'amend', 'amino', 'amiss', 'amity',
  'among', 'ample', 'angel', 'anger', 'angle', 'angry', 'angst', 'anime', 'ankle',
  'annex', 'annoy', 'apart', 'apple', 'apply', 'apron', 'arena', 'argue', 'arise',
  'armed', 'array', 'arrow', 'arson', 'aside', 'asked', 'asker', 'asset', 'astir',
  'atlas', 'atoll', 'atone', 'attic', 'audio', 'audit', 'aunts', 'avail', 'avert',
  'avian', 'avoid', 'await', 'awake', 'award', 'aware', 'awful', 'awoke', 'axing',
  'axiom', 'badge', 'badly', 'bagel', 'baker', 'baled', 'baler', 'bales', 'balls',
  'bands', 'banes', 'banjo', 'banks', 'barge', 'barns', 'baron', 'based', 'baser',
  'bases', 'basic', 'basil', 'basin', 'basis', 'baste', 'batch', 'bathe', 'baths',
  'baton', 'beach', 'beads', 'beans', 'bears', 'beard', 'beast', 'beats', 'beech',
  'beefs', 'began', 'begin', 'begun', 'being', 'belch', 'belie', 'belle', 'belly',
  'below', 'belts', 'bench', 'bends', 'beret', 'berry', 'beset', 'biased', 'bible',
  'bicep', 'biker', 'biped', 'birch', 'birds', 'birth', 'bison', 'biter', 'bites',
  'bitty', 'black', 'blade', 'blame', 'bland', 'blank', 'blare', 'blast', 'blaze',
  'bleak', 'bleat', 'bleed', 'bleep', 'blend', 'bless', 'blest', 'blimp', 'blind',
  'bling', 'blink', 'bliss', 'block', 'bloke', 'blond', 'blood', 'bloom', 'blown',
  'blows', 'blunt', 'blurb', 'blurs', 'blurt', 'blush', 'board', 'boast', 'boats',
  'bobby', 'boded', 'bodes', 'boggy', 'boils', 'bolts', 'bombs', 'bonds', 'boned',
  'boner', 'bones', 'bongo', 'bonny', 'bonus', 'booby', 'booed', 'books', 'boost',
  'booth', 'booty', 'booze', 'borax', 'bored', 'borer', 'bores', 'borne', 'bosom',
  'bossy', 'botch', 'bough', 'bound', 'bouts', 'bowed', 'bowel', 'bowls', 'boxed',
  'boxer', 'boxes', 'brace', 'brain', 'brake', 'brand', 'brash', 'brass', 'brave',
  'bread', 'break', 'breed', 'briar', 'bribe', 'brick', 'bride', 'brief', 'briny',
  'bring', 'brink', 'briny', 'brisk', 'broad', 'broke', 'brood', 'brook', 'broom',
  'broth', 'brown', 'brunt', 'brush', 'brute', 'buddy', 'budge', 'buggy', 'bugle',
  'build', 'built', 'bulge', 'bulky', 'bumpy', 'bunch', 'bunny', 'burly', 'burns',
  'burnt', 'burst', 'bused', 'bushy', 'butch', 'butte', 'buyer', 'cabin', 'cable',
  'cacao', 'caddy', 'cadet', 'cagey', 'cairn', 'cakes', 'cameo', 'canal', 'candy',
  'caned', 'canes', 'canoe', 'caper', 'capes', 'cards', 'cared', 'carer', 'cares',
  'cargo', 'carol', 'carps', 'carry', 'carts', 'caste', 'catch', 'cater', 'cause',
  'caves', 'cease', 'cedar', 'celeb', 'cello', 'chafe', 'chain', 'chair', 'chalk',
  'champ', 'chant', 'chaos', 'chaps', 'chard', 'charm', 'chars', 'chart', 'chase',
  'chasm', 'cheap', 'cheat', 'check', 'cheek', 'cheer', 'chefs', 'chess', 'chest',
  'chick', 'chide', 'chief', 'child', 'chili', 'chill', 'chime', 'chimp', 'chins',
  'chips', 'chirp', 'choir', 'choke', 'chomp', 'chops', 'chord', 'chore', 'chose',
  'chuck', 'chump', 'chunk', 'churn', 'chute', 'cider', 'cigar', 'cinch', 'cited',
  'cites', 'civic', 'civil', 'clack', 'claim', 'clamp', 'clams', 'clams', 'clang',
  'clank', 'clans', 'claps', 'clash', 'clasp', 'class', 'claws', 'clean', 'clear',
  'cleat', 'cleft', 'clerk', 'click', 'cliff', 'climb', 'cling', 'clink', 'clips',
  'cloak', 'clock', 'clogs', 'clone', 'close', 'cloth', 'cloud', 'clout', 'clove',
  'clown', 'clubs', 'cluck', 'clued', 'clues', 'clump', 'clung', 'coach', 'coals',
  'coast', 'coats', 'cobra', 'cocoa', 'codes', 'coils', 'coins', 'colon', 'color',
  'comet', 'comic', 'comma', 'cones', 'conga', 'conic', 'cooed', 'cools', 'copes',
  'copra', 'coral', 'cords', 'cores', 'corks', 'corns', 'corps', 'costs', 'couch',
  'cough', 'could', 'count', 'court', 'coven', 'cover', 'coves', 'covet', 'cowed',
  'cowls', 'crabs', 'crack', 'craft', 'cramp', 'crane', 'crank', 'craps', 'crash',
  'crass', 'crate', 'crave', 'crawl', 'craze', 'crazy', 'cream', 'creed', 'creek',
  'creep', 'creme', 'crepe', 'crest', 'crews', 'cribs', 'cried', 'crier', 'cries',
  'crime', 'crimp', 'crisp', 'croak', 'crock', 'crony', 'crook', 'crops', 'cross',
  'croup', 'crowd', 'crown', 'crows', 'crude', 'cruel', 'crumb', 'crush', 'crust',
  'crypt', 'cubed', 'cubes', 'cubic', 'cubit', 'cuffs', 'curbs', 'curds', 'cured',
  'cures', 'curio', 'curls', 'curly', 'curry', 'curse', 'curve', 'curvy', 'cycle',
  'cynic', 'daddy', 'daily', 'dairy', 'daisy', 'dales', 'dally', 'dance', 'dared',
  'dares', 'darer', 'dares', 'dared', 'darks', 'darts', 'dated', 'dater', 'dates',
  'dawns', 'dealt', 'death', 'debit', 'debug', 'debut', 'decaf', 'decay', 'deeds',
  'deems', 'deeps', 'deers', 'defer', 'deify', 'deign', 'deity', 'delay', 'delta',
  'delve', 'demon', 'denim', 'dense', 'dents', 'depot', 'depth', 'derby', 'deter',
  'detox', 'deuce', 'devil', 'diary', 'diced', 'dices', 'diets', 'digit', 'dimly',
  'dimes', 'diner', 'dines', 'dingo', 'dingy', 'dirty', 'discs', 'disco', 'dirge',
  'ditch', 'ditty', 'divan', 'dived', 'diver', 'dives', 'divot', 'dizzy', 'docks',
  'dodge', 'dodgy', 'doers', 'doffs', 'doges', 'doily', 'doled', 'doles', 'dolls',
  'dolly', 'donor', 'donut', 'doody', 'dooms', 'doors', 'doped', 'dopes', 'dopey',
  'dosed', 'doses', 'doted', 'doter', 'dotes', 'doubt', 'dough', 'doves', 'dowdy',
  'dowel', 'downs', 'downy', 'dowry', 'dowse', 'dozed', 'dozen', 'dozes', 'draft',
  'drags', 'drain', 'drake', 'drama', 'drank', 'drape', 'drawl', 'drawn', 'draws',
  'drays', 'dread', 'dream', 'dreamt', 'dregs', 'dress', 'dried', 'drier', 'dries',
  'drift', 'drill', 'drink', 'drips', 'drive', 'drone', 'drool', 'droop', 'drops',
  'dross', 'drove', 'drown', 'drugs', 'drums', 'drunk', 'drupe', 'dryad', 'dryer',
  'dryly', 'duals', 'ducal', 'ducks', 'ducts', 'dudes', 'duels', 'duets', 'dukes',
  'dully', 'dummy', 'dumps', 'dumpy', 'dunce', 'dunes', 'dungs', 'dunks', 'duped',
  'dupes', 'dural', 'durum', 'dusks', 'dusky', 'dusts', 'dusty', 'duvet', 'dwarf',
  'dwell', 'dwelt', 'dyads', 'dyers', 'dying', 'eager', 'eagle', 'early', 'earls',
  'earns', 'earth', 'eased', 'easel', 'eases', 'eaten', 'eater', 'eaves', 'ebbed',
  'ebony', 'edged', 'edger', 'edges', 'edict', 'eider', 'eight', 'eject', 'eked',
  'elate', 'elbow', 'elder', 'elect', 'elegy', 'elfin', 'elide', 'elite', 'elope',
  'elude', 'email', 'embed', 'ember', 'emcee', 'emery', 'emits', 'empty', 'enact',
  'ended', 'endow', 'enema', 'enemy', 'enjoy', 'ennui', 'ensue', 'enter', 'entry',
  'envoy', 'epoch', 'equal', 'equip', 'erase', 'erect', 'erode', 'erred', 'error',
  'erupt', 'essay', 'ester', 'ethic', 'ethos', 'evade', 'event', 'every', 'evict',
  'evoke', 'exact', 'exalt', 'exams', 'excel', 'exert', 'exile', 'exist', 'extol',
  'extra', 'exult', 'eying', 'fable', 'faced', 'faces', 'facet', 'facts', 'faded',
  'fades', 'fails', 'faint', 'fairs', 'fairy', 'faith', 'faker', 'fakes', 'falls',
  'false', 'famed', 'fancy', 'fangs', 'fanny', 'farce', 'fared', 'fares', 'farms',
  'fasts', 'fated', 'fates', 'fatso', 'fatty', 'fault', 'fauna', 'favor', 'fawns',
  'faxed', 'faxes', 'fazed', 'fears', 'feast', 'feats', 'fecal', 'feces', 'feeds',
  'feels', 'feign', 'felon', 'felts', 'femur', 'fence', 'fends', 'feral', 'ferns',
  'ferry', 'fetal', 'fetch', 'fetid', 'fetus', 'feuds', 'fever', 'fewer', 'fiats',
  'fiber', 'fiche', 'fickle', 'field', 'fiend', 'fiery', 'fifes', 'fifth', 'fifty',
  'fight', 'filch', 'filed', 'filer', 'files', 'fills', 'filly', 'films', 'filmy',
  'final', 'finch', 'finds', 'fined', 'finer', 'fines', 'finis', 'fined', 'fired',
  'fires', 'firms', 'first', 'fishy', 'fists', 'fitly', 'fives', 'fixed', 'fixer',
  'fizzy', 'fjord', 'flack', 'flags', 'flail', 'flair', 'flake', 'flaky', 'flame',
  'flank', 'flans', 'flaps', 'flare', 'flash', 'flask', 'flats', 'flaws', 'flays',
  'fleas', 'fleck', 'fleet', 'flesh', 'flick', 'flier', 'flies', 'fling', 'flint',
  'flips', 'flirt', 'flits', 'float', 'flock', 'flogs', 'flood', 'floor', 'flops',
  'flora', 'floss', 'flour', 'flout', 'flown', 'flows', 'flubs', 'flues', 'fluff',
  'fluid', 'fluke', 'flume', 'flung', 'flunk', 'flush', 'flute', 'flyer', 'foals',
  'foamy', 'focal', 'focus', 'foggy', 'foils', 'foist', 'folds', 'folio', 'folks',
  'folly', 'fonts', 'foods', 'fools', 'foots', 'foray', 'force', 'fords', 'fores',
  'forge', 'forgo', 'forks', 'forms', 'forte', 'forth', 'forts', 'forty', 'forum',
  'found', 'fount', 'fours', 'fowls', 'foxes', 'foyer', 'frail', 'frame', 'frank',
  'frats', 'fraud', 'frays', 'freak', 'freed', 'freer', 'frees', 'fresh', 'frets',
  'friar', 'fried', 'fries', 'frill', 'frisk', 'frizz', 'frock', 'frogs', 'froma',
  'frond', 'front', 'frost', 'froth', 'frown', 'froze', 'fruit', 'fudge', 'fuels',
  'fully', 'fumed', 'fumes', 'funds', 'funky', 'funny', 'furls', 'furor', 'furry',
  'fused', 'fuses', 'fussy', 'fuzzy', 'gable', 'gaffe', 'gaffs', 'gaily', 'gains',
  'gaits', 'galas', 'gales', 'galls', 'gamed', 'gamer', 'games', 'gamey', 'gamma',
  'gamut', 'gangs', 'gaped', 'gapes', 'garbs', 'gases', 'gasps', 'gated', 'gates',
  'gator', 'gaudy', 'gauge', 'gaunt', 'gauze', 'gavel', 'gawks', 'gawky', 'gazed',
  'gazes', 'gears', 'gecko', 'geeks', 'geeky', 'geese', 'gelid', 'gemmy', 'genes',
  'genie', 'genre', 'gents', 'germs', 'getup', 'ghost', 'ghoul', 'giant', 'gibes',
  'giddy', 'gifts', 'gilds', 'gills', 'gilts', 'gimme', 'girds', 'girls', 'girth',
  'given', 'giver', 'gives', 'glade', 'glads', 'glans', 'glare', 'glass', 'glaze',
  'gleam', 'glean', 'glees', 'glens', 'glide', 'glint', 'glitz', 'gloat', 'globe',
  'globs', 'gloom', 'glops', 'glory', 'gloss', 'glove', 'glows', 'glued', 'glues',
  'gluey', 'glyph', 'gnarl', 'gnash', 'gnats', 'gnaws', 'goads', 'goals', 'goats',
  'godly', 'going', 'gongs', 'goods', 'goody', 'gooey', 'goofs', 'goofy', 'goons',
  'goose', 'gored', 'gores', 'gorge', 'gouge', 'gourd', 'gowns', 'grabs', 'grace',
  'grade', 'graft', 'grail', 'grain', 'grand', 'grant', 'grape', 'graph', 'grasp',
  'grass', 'grate', 'grave', 'gravy', 'graze', 'great', 'greed', 'greek', 'green',
  'greet', 'grew', 'greys', 'grids', 'grief', 'grill', 'grime', 'grimy', 'grind',
  'grins', 'grips', 'gripe', 'grist', 'grits', 'groan', 'groin', 'grope', 'gross',
  'group', 'grout', 'grove', 'growl', 'grown', 'grows', 'grubs', 'gruel', 'gruff',
  'grunt', 'guard', 'guava', 'guess', 'guest', 'guide', 'guild', 'guile', 'guilt',
  'guise', 'gulch', 'gulfs', 'gulls', 'gully', 'gulps', 'gumbo', 'gummy', 'gunks',
  'gunky', 'gurus', 'gushy', 'gusto', 'gusts', 'gusty', 'gutsy', 'guyed', 'gyrate',

  // 6-letter words
  'abrupt', 'absent', 'accent', 'accept', 'access', 'accord', 'accuse', 'acidic',
  'across', 'action', 'active', 'actors', 'actual', 'adapts', 'addend', 'adders',
  'addict', 'adding', 'admire', 'admits', 'adopts', 'adorns', 'adverb', 'advice',
  'advise', 'aerial', 'affair', 'affect', 'affirm', 'afford', 'afield', 'afraid',
  'afresh', 'agency', 'agenda', 'agents', 'agents', 'aikido', 'airbag', 'airing',
  'airman', 'airway', 'alarms', 'albeit', 'albino', 'albums', 'alerts', 'algae',
  'aliens', 'aligns', 'allege', 'allies', 'allots', 'allows', 'allure', 'almond',
  'almost', 'always', 'amazed', 'amazon', 'ambers', 'ambush', 'amends', 'amidst',
  'amount', 'amused', 'angels', 'angers', 'angled', 'angler', 'angles', 'animal',
  'anklet', 'annals', 'annexe', 'annoys', 'annual', 'answer', 'anthem', 'antics',
  'anyone', 'anyway', 'aortas', 'apathy', 'apiece', 'appeal', 'appear', 'arcade',
  'archly', 'ardent', 'argued', 'argues', 'arming', 'arrest', 'arrive', 'arrows',
  'artery', 'artful', 'artist', 'asleep', 'aspect', 'aspire', 'assail', 'assent',
  'assert', 'assess', 'assign', 'assist', 'assume', 'assure', 'asters', 'astute',
  'atomic', 'attach', 'attack', 'attain', 'attend', 'attest', 'attire', 'augers',
  'august', 'aunts', 'aurora', 'autism', 'autumn', 'avatar', 'avenge', 'avenue',
  'averse', 'aviary', 'avider', 'avocet', 'avoids', 'avowal', 'avowed', 'awaits',
  'awaken', 'awards', 'aweary', 'awhile', 'axioms', 'badger', 'baffle', 'bagels',
  'bailed', 'baking', 'balded', 'banded', 'banger', 'banish', 'banker', 'banner',
  'banter', 'barely', 'barest', 'barged', 'barges', 'barker', 'barned', 'barons',
  'barrel', 'barren', 'barrow', 'barter', 'baseds', 'bashed', 'basics', 'basics',
  'basket', 'basset', 'bathed', 'batter', 'battle', 'bayous', 'bazaar', 'beacon',
  'beaded', 'beaker', 'beamed', 'beanie', 'beards', 'bearer', 'beasts', 'beaten',
  'beater', 'beauty', 'beaver', 'became', 'become', 'bedbug', 'bedded', 'beeped',
  'beeper', 'before', 'begged', 'begins', 'behalf', 'behave', 'behold', 'belief',
  'belles', 'belong', 'belted', 'bemoan', 'bender', 'beside', 'better', 'bigger',
  'bikers', 'bikini', 'billed', 'binary', 'binder', 'biopic', 'birded', 'birded',
  'birdie', 'bishop', 'biters', 'bitter', 'blamed', 'blamer', 'blames', 'blared',
  'blares', 'blasts', 'blazed', 'blazer', 'blazes', 'bleach', 'bleeds', 'blends',
  'blight', 'blinks', 'blocks', 'blonde', 'bloods', 'blooms', 'blotch', 'blouse',
  'blower', 'blowup', 'bluest', 'bluffs', 'bluish', 'blunts', 'boards', 'boasts',
  'boater', 'bodice', 'bodies', 'boggle', 'bolder', 'bolted', 'bombed', 'bomber',
  'bonded', 'bonnet', 'bonsai', 'bonus', 'boners', 'booed', 'boohoo', 'booked',
  'border', 'boring', 'borrow', 'bosses', 'botany', 'bother', 'bottle', 'bottom',
  'bouncy', 'bounds', 'bounty', 'bovine', 'bowels', 'bowers', 'bowing', 'bowled',
  'boxers', 'boxing', 'boyish', 'braced', 'braces', 'bracts', 'brains', 'brainy',
  'braise', 'braked', 'brakes', 'branch', 'brands', 'brandy', 'brassy', 'bravas',
  'braved', 'braver', 'braves', 'brawls', 'brawny', 'brayed', 'brazen', 'breach',
  'breads', 'breaks', 'breast', 'breath', 'breeds', 'breeze', 'brewed', 'brewer',
  'briars', 'bribed', 'bribes', 'bricks', 'bridal', 'brides', 'bridge', 'briefs',
  'bright', 'bring', 'brings', 'brinks', 'briny', 'broach', 'broads', 'brogue',
  'broils', 'broken', 'broker', 'bronze', 'brooch', 'broody', 'brooks', 'brooms',
  'broths', 'browse', 'bruise', 'brunch', 'brunts', 'brushy', 'brutal', 'brutes',
  'bubble', 'bucked', 'bucket', 'buckle', 'budded', 'budget', 'buffet', 'bugged',
  'bugler', 'bugles', 'bulged', 'bulges', 'bulked', 'bullet', 'bumble', 'bumped',
  'bumper', 'bunchy', 'bundle', 'bunged', 'bungle', 'bunked', 'bunker', 'bunkum',
  'bunted', 'burden', 'bureau', 'burger', 'buried', 'buries', 'burlap', 'burned',
  'burner', 'burped', 'burrow', 'bursar', 'bursts', 'bushel', 'busted', 'buster',
  'bustle', 'busted', 'butane', 'butler', 'butted', 'butter', 'button', 'buyers',
  'buying', 'buzzed', 'buzzer', 'buzzes', 'bygone', 'byline', 'bypass', 'cabins',
  'cables', 'cacao', 'cached', 'cackle', 'cactus', 'caddie', 'cadets', 'caftan',
  'cagier', 'cajole', 'calmed', 'calmer', 'calmly', 'calved', 'calves', 'camped',
  'camper', 'campus', 'canals', 'canary', 'cancel', 'cancer', 'candid', 'candle',
  'candor', 'caned', 'canine', 'canker', 'canned', 'canoes', 'canopy', 'canter',
  'canyon', 'capers', 'capped', 'carafe', 'carats', 'carbon', 'carded', 'carers',
  'caress', 'caring', 'carnal', 'carols', 'carpal', 'carped', 'carpel', 'carpet',
  'carrel', 'carrot', 'carted', 'carter', 'carton', 'carved', 'carves', 'cashed',
  'cashew', 'casing', 'casino', 'casket', 'casual', 'caters', 'caught', 'causal',
  'caused', 'causes', 'cavern', 'caving', 'cavity', 'cavort', 'celery', 'cellar',
  'cement', 'censor', 'census', 'center', 'cereal', 'cherry', 'chosen', 'church',
  'circle', 'clever', 'client', 'closed', 'closer', 'coffee', 'coming', 'common',
  'cookie', 'corner', 'create', 'damper', 'danced', 'dancer', 'dances', 'danger',
  'darken', 'darted', 'darken', 'darnel', 'darted', 'dashed', 'dashes', 'dated',
  'dating', 'daubed', 'daubs', 'dawned', 'daylit', 'dazzle', 'deafen', 'dearer',
  'death', 'debase', 'debate', 'debits', 'debris', 'debtor', 'debunk', 'decade',
  'decals', 'decamp', 'decant', 'decays', 'decide', 'decked', 'decode', 'decree',
  'deeded', 'deemed', 'deepen', 'deeper', 'defame', 'defeat', 'defect', 'defend',
  'defers', 'define', 'deform', 'defray', 'defter', 'deftly', 'degree', 'deices',
  'deigns', 'deject', 'delays', 'delete', 'delude', 'deluge', 'deluxe', 'delved',
  'delves', 'demean', 'demote', 'demure', 'denial', 'denied', 'denier', 'denote',
  'dented', 'dentin', 'denude', 'depart', 'depend', 'depict', 'deploy', 'deport',
  'depose', 'depots', 'depths', 'deputy', 'derail', 'derbies', 'derive', 'derma',
  'descry', 'desert', 'design', 'desire', 'desist', 'desks', 'detach', 'detail',
  'detain', 'detect', 'deters', 'detour', 'detest', 'device', 'devise', 'devoid',
  'devote', 'devour', 'devout', 'dialed', 'dialog', 'diaper', 'diarist', 'dice',
  'dicey', 'dictum', 'didoes', 'differ', 'digest', 'digger', 'digits', 'dilate',
  'dilute', 'dimmed', 'dimmer', 'dimple', 'dimwit', 'dinged', 'diners', 'dingos',
  'dinner', 'dipole', 'dipped', 'dipper', 'direct', 'direly', 'dirges', 'disarm',
  'disbar', 'disc', 'disco', 'discus', 'dished', 'dishes', 'dismal', 'dismay',
  'disown', 'dispel', 'distal', 'distil', 'ditched', 'diver', 'divers', 'divert',
  'divest', 'divide', 'divine', 'diving', 'divots', 'docent', 'docile', 'docked',
  'docket', 'doctor', 'dodder', 'dodged', 'dodger', 'dodges', 'doffed', 'doffs',
  'dogged', 'doggie', 'doggy', 'doings', 'doled', 'doled', 'dolled', 'dolls',
  'dolly', 'dolmen', 'domain', 'domed', 'domes', 'domino', 'donate', 'donkey',
  'donned', 'donors', 'donuts', 'doodad', 'doodle', 'doomed', 'doorls', 'doosed',
  'doping', 'dosage', 'dosing', 'dotage', 'doting', 'dotted', 'double', 'doubts',
  'doughs', 'doughy', 'dourly', 'doused', 'douses', 'dovish', 'dowels', 'downed',
  'downer', 'dowsed', 'dowses', 'dozens', 'drafts', 'drafty', 'dragon', 'drains',
  'drakes', 'dramas', 'draped', 'drapes', 'drapery', 'drawer', 'drawls', 'drawly',
  'dreams', 'dreamy', 'dreary', 'dredge', 'drench', 'dressy', 'driers', 'drifts',
  'drills', 'drinks', 'dripped', 'drives', 'driven', 'driver', 'drives', 'drogue',
  'droids', 'droits', 'droll', 'droned', 'drones', 'drools', 'droops', 'droopy',
  'dropsy', 'drosky', 'drowse', 'drowsy', 'drudge', 'druids', 'drumly', 'drunks',
  'drupes', 'dryads', 'dryers', 'dryish', 'drying', 'duenna', 'duffel', 'dugout',
  'dukely', 'duller', 'dulse', 'dumbly', 'dumped', 'dumper', 'dunces', 'dunked',
  'duplex', 'duress', 'during', 'dusker', 'dusted', 'duster', 'duties', 'duvets',
  'dwarfs', 'dwells', 'dyeing', 'dynamo', 'eaglet', 'earful', 'earned', 'earner',
  'earths', 'earthy', 'easels', 'easier', 'easily', 'eaters', 'eatery', 'eating',
  'ebbing', 'echoed', 'echoes', 'ecstasy', 'eddies', 'edgier', 'edgily', 'edging',
  'edible', 'edicts', 'edited', 'editor', 'effigy', 'effort', 'efflux', 'effuse',
  'eggers', 'egging', 'eggnog', 'egoism', 'egoist', 'either', 'elapse', 'elated',
  'elates', 'elbows', 'eldest', 'elects', 'elegit', 'eleven', 'elicit', 'eliding',
  'elites', 'elitism', 'elixir', 'eloped', 'eloper', 'elopes', 'eluded', 'eludes',
  'emails', 'embalm', 'embank', 'embeds', 'embers', 'emblem', 'embody', 'emboss',
  'embryo', 'emcees', 'emerge', 'emetic', 'emigre', 'emoted', 'emotes', 'empire',
  'employ', 'emptys', 'emptier', 'emptys', 'enable', 'enacts', 'enamel', 'encamp',
  'encase', 'encore', 'endear', 'endive', 'endure', 'enemas', 'energy', 'enfeoff',
  'enface', 'enfold', 'engage', 'engine', 'engulf', 'enigma', 'enjoin', 'enjoys',
  'enlist', 'enmity', 'ennui', 'enough', 'enrage', 'enrich', 'enrobe', 'enroll',
  'ensure', 'entail', 'enters', 'entice', 'entire', 'entomb', 'entree', 'enures',
  'envied', 'envies', 'envoys', 'enzyme', 'eolith', 'eonism', 'eonist', 'eparchies',
  'epaulet', 'epees', 'ephebes', 'epics', 'epigon', 'epilog', 'epitomic', 'epoxies',
  'equals', 'equate', 'equine', 'equips', 'equity', 'erased', 'eraser', 'erases',
  'erects', 'ermine', 'eroded', 'erodes', 'erotic', 'errand', 'errant', 'errata',
  'erupts', 'escape', 'eschew', 'escort', 'escrow', 'estate', 'esteem', 'ethics',
  'ethnic', 'eulogy', 'evader', 'evades', 'events', 'evicts', 'evince', 'evited',
  'evoked', 'evokes', 'evolve', 'exalts', 'examen', 'except', 'excess', 'excite',
  'excuse', 'exempt', 'exerts', 'exhale', 'exhort', 'exhume', 'exiled', 'exiles',
  'exists', 'exited', 'exodus', 'exotic', 'expand', 'expect', 'expels', 'expend',
  'expert', 'expire', 'export', 'expose', 'extant', 'extend', 'extent', 'extols',
  'extort', 'extras', 'exuded', 'exudes', 'exults', 'eyeing', 'fables', 'fabled',
  'fabric', 'facade', 'facets', 'facial', 'facing', 'factor', 'faders', 'fading',
  'faerie', 'fagged', 'failed', 'faints', 'fairer', 'fairly', 'faiths', 'fakers',
  'faking', 'falcon', 'fallow', 'falter', 'family', 'famine', 'famous', 'fanned',
  'fanner', 'farted', 'forest', 'forget', 'forgot', 'format', 'former', 'fought',
  'french', 'friend', 'galaxy', 'garage', 'garden', 'gather', 'gentle', 'global',
  'golden', 'ground', 'growth', 'handle', 'happen', 'health', 'hidden', 'honest',
  'hostel', 'hunter', 'island', 'jacket', 'jungle', 'killer', 'kindle', 'kindly',
  'ladder', 'lately', 'launch', 'lawyer', 'leader', 'lesson', 'letter', 'lights',
  'listen', 'little', 'liquid', 'lively', 'living', 'lonely', 'longer', 'lovely',
  'lover', 'lovers', 'lucky', 'luxury', 'magnet', 'mainly', 'majors', 'making',
  'manage', 'manner', 'manual', 'marble', 'margin', 'marine', 'marker', 'market',
  'master', 'mature', 'matter', 'mature', 'medium', 'memory', 'mental', 'mentor',
  'merger', 'method', 'middle', 'minute', 'mirror', 'modern', 'modest', 'moment',
  'monkey', 'mostly', 'mother', 'motion', 'motive', 'mounts', 'movies', 'moving',
  'murder', 'museum', 'mutual', 'myself', 'native', 'nature', 'nearby', 'nearly',
  'needle', 'neglect', 'nerves', 'newest', 'nimble', 'nobody', 'normal', 'notice',
  'notion', 'novels', 'number', 'nursed', 'oblige', 'obtain', 'occupy', 'occur',
  'office', 'offset', 'online', 'option', 'orange', 'origin', 'output', 'oxygen',
  'painting', 'parent', 'partner', 'passed', 'patrol', 'patter', 'patterns',
  'people', 'period', 'permit', 'person', 'phrase', 'pickle', 'picnic', 'pierce',
  'planet', 'plants', 'player', 'please', 'plenty', 'pocket', 'police', 'policy',
  'polish', 'pollen', 'ponder', 'poster', 'pounds', 'powers', 'prayer', 'prefer',
  'prince', 'prison', 'proper', 'public', 'puppet', 'purple', 'pursue', 'puzzle',
  'random', 'rather', 'reader', 'really', 'reason', 'recall', 'recent', 'record',
  'reduce', 'reform', 'refuse', 'regard', 'region', 'remain', 'remark', 'remedy',
  'remind', 'remote', 'remove', 'repair', 'repeat', 'report', 'rescue', 'result',
  'retain', 'return', 'reveal', 'review', 'reward', 'rocket', 'rugged', 'runner',
  'sailor', 'salads', 'sample', 'satire', 'saving', 'screen', 'search', 'season',
  'second', 'secret', 'sector', 'secure', 'seeker', 'seemed', 'select', 'seller',
  'senate', 'sender', 'sensor', 'series', 'sermon', 'server', 'settle', 'sharks',
  'sheets', 'shelf', 'shield', 'should', 'silent', 'silver', 'simple', 'simply',
  'singer', 'sister', 'slight', 'smooth', 'social', 'soften', 'solely', 'solved',
  'soothe', 'sorted', 'source', 'spirit', 'spoken', 'spread', 'spring', 'square',
  'stable', 'stairs', 'static', 'status', 'stayed', 'steady', 'steals', 'stones',
  'stored', 'street', 'strike', 'strong', 'studio', 'stupid', 'submit', 'subtle',
  'sudden', 'suffer', 'summer', 'sunset', 'supply', 'surely', 'survey', 'switch',
  'symbol', 'system', 'tackle', 'talent', 'target', 'taught', 'tested', 'thanks',
  'theory', 'thirty', 'though', 'thread', 'threat', 'thrown', 'tiered', 'timber',
  'timely', 'tissue', 'toward', 'travel', 'treats', 'trends', 'trying', 'tunnel',
  'turned', 'twelve', 'twenty', 'unable', 'unique', 'united', 'unlike', 'unseen',
  'urgent', 'useful', 'valley', 'vendor', 'verbal', 'victim', 'vision', 'visual',
  'voices', 'voting', 'walked', 'wallet', 'wander', 'wanted', 'warmth', 'wealth',
  'weapon', 'weekly', 'weight', 'wholly', 'window', 'winter', 'wisdom', 'wished',
  'wonder', 'worker', 'wraith', 'writer', 'yellow',

  // 7-letter words
  'ability', 'absence', 'academy', 'account', 'accused', 'achieve', 'acquire',
  'address', 'adopted', 'advance', 'adverse', 'advised', 'against', 'airline',
  'airport', 'alcohol', 'already', 'amazing', 'amongst', 'analyst', 'ancient',
  'angular', 'animals', 'another', 'answers', 'anxiety', 'anybody', 'anymore',
  'anyone', 'anyplace', 'apparel', 'applied', 'arrange', 'arrival', 'article',
  'asking', 'aspects', 'assault', 'assured', 'athlete', 'attempt', 'attract',
  'auction', 'average', 'awarded', 'baggage', 'banking', 'banners', 'baptism',
  'barrier', 'battery', 'bearing', 'beating', 'because', 'bedroom', 'beneath',
  'benefit', 'besides', 'between', 'bicycle', 'bizarre', 'blanket', 'blocked',
  'blossom', 'blowing', 'bonjour', 'bracket', 'brigade', 'brother', 'brought',
  'bruised', 'buffalo', 'builder', 'burning', 'cabinet', 'campaign', 'capital',
  'captain', 'capture', 'careful', 'carpets', 'carrier', 'caution', 'ceiling',
  'central', 'century', 'certain', 'chamber', 'chapter', 'charity', 'charter',
  'cheaper', 'chicken', 'chronic', 'circuit', 'citizen', 'classic', 'cleaner',
  'cleaned', 'clearly', 'climate', 'closing', 'cluster', 'collect', 'college',
  'combine', 'comfort', 'command', 'comment', 'company', 'compare', 'compete',
  'complex', 'comment', 'concept', 'concern', 'concert', 'conduct', 'confirm',
  'connect', 'consent', 'consist', 'contact', 'contain', 'content', 'contest',
  'context', 'control', 'convert', 'correct', 'council', 'counsel', 'counter',
  'country', 'courage', 'cousins', 'crisis', 'culture', 'cunning', 'current',
  'curtain', 'cushion', 'cutting', 'dancing', 'darling', 'declare', 'deepest',
  'default', 'defense', 'deliver', 'denoted', 'descent', 'deserve', 'desktop',
  'despite', 'destiny', 'destroy', 'develop', 'devoted', 'diamond', 'digital',
  'dignity', 'discuss', 'disease', 'display', 'dispose', 'dispute', 'distant',
  'distinct', 'diverse', 'divided', 'donated', 'drawing', 'dressed', 'drinker',
  'driving', 'dropped', 'durable', 'dynasty', 'earlier', 'eastern', 'economy',
  'edition', 'eclipse', 'elderly', 'elegant', 'element', 'elevate', 'embrace',
  'emerald', 'emotion', 'enabled', 'endless', 'engaged', 'english', 'enhance',
  'enjoyed', 'episode', 'equally', 'esquire', 'essence', 'evening', 'evident',
  'examine', 'example', 'excited', 'exhibit', 'expense', 'extreme', 'factory',
  'failure', 'fantasy', 'farmers', 'fastest', 'feature', 'federal', 'feeling',
  'fiction', 'filling', 'finally', 'finance', 'finding', 'fishing', 'fitness',
  'foreign', 'forever', 'fortune', 'forward', 'founder', 'freedom', 'frequent',
  'friends', 'further', 'gallery', 'gateway', 'genuine', 'gesture', 'getting',
  'glasses', 'glimpse', 'gravity', 'greater', 'growing', 'guitars', 'habitat',
  'hanging', 'harbour', 'harmony', 'harvest', 'healing', 'hearing', 'helpful',
  'herself', 'highway', 'himself', 'history', 'holding', 'holiday', 'hopeful',
  'hostage', 'housing', 'however', 'hundred', 'husband', 'imagine', 'imports',
  'improve', 'inanimate', 'include', 'initial', 'inquiry', 'install', 'instead',
  'intense', 'invited', 'jealous', 'journal', 'journey', 'justify', 'killing',
  'kingdom', 'kitchen', 'knowing', 'largely', 'largest', 'laundry', 'lawsuit',
  'leading', 'learned', 'leather', 'lecture', 'liberal', 'liberty', 'library',
  'license', 'limited', 'longing', 'looking', 'machine', 'manager', 'married',
  'massive', 'matters', 'maximum', 'meaning', 'measure', 'medical', 'meeting',
  'message', 'midwest', 'migrate', 'million', 'minimal', 'minimum', 'mineral',
  'mineral', 'mineral', 'mission', 'monitor', 'monster', 'monthly', 'morning',
  'musical', 'mystery', 'natural', 'nervous', 'network', 'nominee', 'noticed',
  'nothing', 'nowhere', 'nuclear', 'observe', 'obvious', 'offense', 'offered',
  'offices', 'officer', 'opening', 'opinion', 'orderly', 'organic', 'outcome',
  'outdoor', 'outline', 'outlook', 'outside', 'overall', 'package', 'painted',
  'painter', 'panther', 'parking', 'partial', 'parties', 'partner', 'passage',
  'passing', 'pattern', 'payment', 'penalty', 'pending', 'pension', 'percent',
  'perfect', 'perhaps', 'persist', 'phantom', 'pharaoh', 'phoenix', 'picking',
  'picture', 'planned', 'planted', 'plastic', 'plateau', 'pleased', 'pointed',
  'poisons', 'popular', 'portion', 'potions', 'pouring', 'poverty', 'precise',
  'predict', 'premier', 'prepare', 'present', 'pretend', 'prevent', 'previous',
  'primary', 'printer', 'private', 'problem', 'process', 'produce', 'product',
  'profile', 'program', 'project', 'promise', 'promote', 'protect', 'protein',
  'protest', 'provide', 'pumpkin', 'pursuit', 'pushing', 'pyramid', 'quality',
  'quarter', 'quickly', 'rainbow', 'rapidly', 'reached', 'reading', 'realise',
  'reality', 'realize', 'receipt', 'receive', 'recipes', 'recover', 'reflect',
  'refugee', 'related', 'release', 'remains', 'removed', 'replace', 'request',
  'require', 'respect', 'respond', 'restore', 'reveals', 'reverse', 'reviews',
  'rhythms', 'romance', 'running', 'satisfy', 'scholar', 'science', 'section',
  'segment', 'serious', 'service', 'serving', 'session', 'setting', 'several',
  'shelter', 'sherbet', 'shocked', 'shoulder', 'silence', 'silicon', 'similar',
  'sitting', 'sixteen', 'sixties', 'sketches', 'skilled', 'slender', 'slowing',
  'smaller', 'smiling', 'snapped', 'soldier', 'somehow', 'someone', 'speaker',
  'special', 'species', 'spelled', 'sponsor', 'station', 'storage', 'stories',
  'strange', 'stretch', 'striker', 'striped', 'student', 'subject', 'succeed',
  'success', 'suggest', 'suppose', 'supreme', 'surface', 'surgery', 'survive',
  'sustain', 'symptom', 'teacher', 'tequila', 'theatre', 'theirs', 'thinker',
  'thinned', 'thought', 'through', 'tonight', 'totally', 'tourism', 'tourist',
  'tracker', 'tractor', 'trained', 'trainer', 'travels', 'trigger', 'trouble',
  'tuition', 'unaware', 'unicorn', 'uniform', 'unknown', 'unusual', 'updated',
  'upgrade', 'upwards', 'urgency', 'useless', 'utility', 'utopian', 'vacancy',
  'vampire', 'variety', 'various', 'vehicle', 'venture', 'version', 'veteran',
  'victims', 'victory', 'village', 'violent', 'virtual', 'visible', 'visitor',
  'wanting', 'warning', 'warrior', 'watched', 'waterfall', 'wearing', 'weather',
  'wedding', 'weekend', 'weights', 'welcome', 'western', 'whisper', 'whoever',
  'willing', 'winning', 'witness', 'workout', 'worried', 'writers', 'writing',
  'written', 'younger', 'yourself',
];

// De-duplicate and lowercase the dictionary into a Set for fast lookup.
const DICTIONARY: Set<string> = new Set(
  DICTIONARY_WORDS.map((w) => w.toLowerCase())
);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Return a sorted-letter signature, e.g. "garden" -> "adegnr". Used to
 *  test whether a candidate's letters are a multiset subset of the base. */
function letterSignature(word: string): string {
  return word.toLowerCase().split('').sort().join('');
}

/** Returns true iff every letter (with multiplicity) in `candidate` is
 *  available in `available`. Linear in word length. */
function isMultisetSubset(candidate: string, available: string): boolean {
  const counts: Record<string, number> = {};
  for (const ch of available) {
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  for (const ch of candidate) {
    if (!counts[ch]) return false;
    counts[ch]--;
  }
  return true;
}

/** Score a single found word: 10 pts for a 3-letter word, then +5 per extra
 *  letter. So 3=10, 4=15, 5=20, 6=25, 7=30. The pangram bonus is added
 *  separately on top of this base score. */
function scoreForWord(word: string): number {
  return 10 + Math.max(0, word.length - 3) * 5;
}

const PANGRAM_BONUS = 50;

// ── Difficulty configs ──────────────────────────────────────────────────────

interface DifficultyConfig {
  letterCount: number;   // 5..7 (also the pangram length)
  timeLimit: number;     // seconds
  targetWords: number;   // need this many to win
  requirePangram: boolean;
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { letterCount: 5, timeLimit: 90, targetWords: 5,  requirePangram: false }, // Easy
  { letterCount: 6, timeLimit: 90, targetWords: 10, requirePangram: false }, // Medium
  { letterCount: 7, timeLimit: 75, targetWords: 15, requirePangram: true  }, // Hard
  { letterCount: 7, timeLimit: 60, targetWords: 20, requirePangram: true  }, // Extra Hard
];

// ── Game ────────────────────────────────────────────────────────────────────

interface FlashMessage {
  text: string;
  color: string;
  timeLeft: number; // seconds remaining
}

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
  label: 'submit' | 'shuffle' | 'clear';
}

interface TileRect {
  x: number;
  y: number;
  r: number;
  index: number; // index into letters[]
  /** Angular position in radians (for debugging + tests). -PI/2 = top. */
  angle: number;
}

class AnagramGame extends GameEngine {
  // Puzzle state
  private base: string = '';            // lowercase pangram, e.g. "garden"
  private letters: string[] = [];       // shuffled tile letters, length = config.letterCount
  private validWords: Set<string> = new Set(); // all valid sub-words for the current puzzle
  private foundWords: string[] = [];    // words player has found, in order
  private foundPangram: boolean = false;
  private currentInput: string = '';    // letters being assembled
  private selectedTiles: number[] = []; // tile indices used by currentInput, in order

  // Timer
  private timeLeft: number = 0;
  private timeLimitSeconds: number = 0;
  private gameActive: boolean = false;

  // Difficulty
  private cfg: DifficultyConfig = DIFFICULTY_CONFIGS[0];

  // Layout (recomputed in init based on canvas size)
  private headerHeight: number = 56;
  private tileCenterX: number = 0;
  private tileCenterY: number = 0;
  private ringRadius: number = 0;
  private tileRadius: number = 28;
  private tilesArea: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  private buttons: ButtonRect[] = [];
  private tileRects: TileRect[] = [];
  private listRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };

  // Drag-to-connect state (radial word picker)
  /** True while a pointer is down on a tile — we're either tapping or dragging. */
  private dragActive: boolean = false;
  /** True once the pointer has moved onto another tile (or backtracked). Used
   *  to decide whether pointer-up should auto-submit. A pure tap (down + up on
   *  the same tile with no drag) stays `false` and preserves click-click mode. */
  private isDragging: boolean = false;
  /** Last known pointer position while a drag is in progress — used to draw
   *  the trailing mauve line from the tail tile to the pointer. */
  private dragPointerX: number = 0;
  private dragPointerY: number = 0;

  // Flash message for feedback ("New word!", "Already found", etc.)
  private flash: FlashMessage | null = null;

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init(): void {
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    this.cfg = DIFFICULTY_CONFIGS[diff];

    // Generate puzzle first so letters exist, then lay out the radial ring.
    this.generatePuzzle();
    this.computeLayout();

    // Reset state
    this.foundWords = [];
    this.foundPangram = false;
    this.currentInput = '';
    this.selectedTiles = [];
    this.timeLeft = this.cfg.timeLimit;
    this.timeLimitSeconds = this.cfg.timeLimit;
    this.gameActive = true;
    this.flash = null;
    this.dragActive = false;
    this.isDragging = false;

    this.setScore(0);
  }

  private computeLayout(): void {
    const W = this.width;
    const H = this.height;

    this.headerHeight = Math.max(40, Math.min(64, H * 0.09));

    // Buttons + found-words list anchor to the bottom of the canvas. We first
    // reserve their space so the radial tile area can expand into what's left.
    const btnH = Math.max(32, Math.min(42, H * 0.055));
    const btnGap = 8;
    const btnW = (W * 0.9 - btnGap * 2) / 3;
    const btnStartX = W * 0.05;

    // Found-words list gets a fixed slice at the very bottom.
    const listH = Math.max(60, Math.min(110, H * 0.16));
    const listY = H - listH - 10;

    const btnY = listY - btnH - 10;

    this.buttons = [
      { x: btnStartX,                       y: btnY, w: btnW, h: btnH, label: 'shuffle' },
      { x: btnStartX + btnW + btnGap,       y: btnY, w: btnW, h: btnH, label: 'clear' },
      { x: btnStartX + (btnW + btnGap) * 2, y: btnY, w: btnW, h: btnH, label: 'submit' },
    ];

    this.listRect = {
      x: W * 0.05,
      y: listY,
      w: W * 0.9,
      h: listH,
    };

    // Tile area: everything between the header and the buttons.
    const tileAreaTop = this.headerHeight + 12;
    const tileAreaHeight = Math.max(120, btnY - tileAreaTop - 10);
    this.tilesArea = {
      x: 0,
      y: tileAreaTop,
      w: W,
      h: tileAreaHeight,
    };

    // Radial picker: tiles on a circle centered in the tile area.
    // Tile radius scales with both canvas width and number of letters so tiles
    // stay comfortable to tap on phones without overlapping on desktop.
    this.tileRadius = Math.max(22, Math.min(34, W * 0.09));
    this.tileCenterX = W / 2;
    this.tileCenterY = tileAreaTop + tileAreaHeight / 2;

    // Ring radius: leave room for the tile circles themselves plus a margin,
    // and cap by ~35% of the canvas width so the picker doesn't feel huge on
    // landscape/desktop.
    const maxByWidth = Math.min(W, H) * 0.35;
    const maxByHeight = tileAreaHeight / 2 - this.tileRadius - 8;
    const minRadius = this.tileRadius * 2.2; // prevents tile overlap at small N
    this.ringRadius = Math.max(minRadius, Math.min(maxByWidth, maxByHeight));

    this.computeTilePositions();
  }

  /** Place each letter on the ring. Tile 0 sits at the top (angle = -PI/2)
   *  and subsequent tiles step clockwise by 2*PI/N. Kept in its own method
   *  so shuffle / deserialize can refresh positions without recomputing the
   *  whole layout. */
  private computeTilePositions(): void {
    const n = this.letters.length;
    this.tileRects = [];
    if (n === 0) return;
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * step;
      const x = this.tileCenterX + Math.cos(angle) * this.ringRadius;
      const y = this.tileCenterY + Math.sin(angle) * this.ringRadius;
      this.tileRects.push({ x, y, r: this.tileRadius, index: i, angle });
    }
  }

  private generatePuzzle(): void {
    // Pick a base whose length matches our difficulty letter count.
    const candidates = ANAGRAM_BASES.filter((b) => b.length === this.cfg.letterCount);
    // Defensive fallback: if for any reason the curated list has no entry of
    // that exact length, fall back to any base trimmed to the right length.
    let basePick: string;
    if (candidates.length > 0) {
      basePick = candidates[Math.floor(this.rng() * candidates.length)];
    } else {
      const allLen = ANAGRAM_BASES.find((b) => b.length >= this.cfg.letterCount) ?? ANAGRAM_BASES[0];
      basePick = allLen.slice(0, this.cfg.letterCount);
    }

    this.base = basePick.toLowerCase();

    // Build letter array from the base, then Fisher-Yates shuffle with this.rng().
    this.letters = this.base.split('');
    this.shuffleLetters();

    // Compute the set of valid sub-words for this base. We scan the dictionary
    // (~500 entries) once: this is O(N * L) where L = max word length.
    this.validWords = new Set();
    const baseSig = letterSignature(this.base);
    // Pre-build a count map of base letters for the multiset subset check.
    for (const word of DICTIONARY) {
      if (word.length < 3) continue;
      if (word.length > this.base.length) continue;
      // Quick reject by length, then exact subset test
      if (!isMultisetSubset(word, this.base)) continue;
      this.validWords.add(word);
    }
    // Always include the pangram itself
    this.validWords.add(this.base);

    // baseSig is referenced for completeness / future debugging
    void baseSig;
  }

  private shuffleLetters(): void {
    // Fisher-Yates with this.rng() for daily-mode determinism.
    for (let i = this.letters.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = this.letters[i];
      this.letters[i] = this.letters[j];
      this.letters[j] = tmp;
    }
  }

  update(dt: number): void {
    if (!this.gameActive) return;

    // Tick timer
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameActive = false;
      this.gameOver();
      return;
    }

    // Tick flash message
    if (this.flash) {
      this.flash.timeLeft -= dt;
      if (this.flash.timeLeft <= 0) {
        this.flash = null;
      }
    }
  }

  render(): void {
    this.clear(BG_COLOR);

    this.renderHeader();
    this.renderRadialPicker();
    this.renderButtons();
    this.renderFoundList();

    if (this.flash) {
      this.renderFlash();
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  private renderHeader(): void {
    const W = this.width;
    const h = this.headerHeight;

    // Header background panel
    this.drawRoundRect(8, 8, W - 16, h - 8, 8, PANEL_COLOR, BORDER_COLOR);

    // Timer (left)
    const t = Math.ceil(this.timeLeft);
    const mm = Math.floor(t / 60);
    const ss = t % 60;
    const timerText = `${mm}:${ss.toString().padStart(2, '0')}`;
    const timerColor = this.timeLeft <= 10 ? ERROR_COLOR : TEXT_DARK;
    this.drawText(timerText, 24, h / 2 + 4, {
      size: 18, color: timerColor, weight: '700', align: 'left',
    });

    // Score (center)
    this.drawText(`${this.score}`, W / 2, h / 2 + 4, {
      size: 20, color: PRIMARY_COLOR, weight: '700',
    });

    // Words counter (right)
    const counterText = `${this.foundWords.length}/${this.cfg.targetWords}`;
    this.drawText(counterText, W - 24, h / 2 + 4, {
      size: 16, color: TEXT_DARK, weight: '600', align: 'right',
    });
  }

  private renderRadialPicker(): void {
    const cx = this.tileCenterX;
    const cy = this.tileCenterY;

    // Faint guide ring so the layout reads as a circle even before any
    // letter is selected.
    this.drawCircle(cx, cy, this.ringRadius, '', BORDER_COLOR, 1);

    // Connecting lines between selected tiles, then from the tail tile to
    // the current drag pointer. Drawn BEHIND the tiles so the tiles cover
    // the line endpoints cleanly.
    if (this.selectedTiles.length > 0 && this.tileRects.length > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = PRIMARY_COLOR;
      this.ctx.lineWidth = Math.max(3, this.tileRadius * 0.18);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      for (let i = 0; i < this.selectedTiles.length; i++) {
        const t = this.tileRects[this.selectedTiles[i]];
        if (!t) continue;
        if (i === 0) this.ctx.moveTo(t.x, t.y);
        else this.ctx.lineTo(t.x, t.y);
      }
      if (this.dragActive && this.isDragging) {
        this.ctx.lineTo(this.dragPointerX, this.dragPointerY);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Tiles themselves.
    for (const tile of this.tileRects) {
      const isSelected = this.selectedTiles.includes(tile.index);
      const fill = isSelected ? TILE_SELECTED_COLOR : TILE_COLOR;
      const stroke = isSelected ? PRIMARY_COLOR : BORDER_COLOR;
      this.drawCircle(tile.x, tile.y, tile.r, fill, stroke, 2);
      this.drawText(this.letters[tile.index].toUpperCase(), tile.x, tile.y + 1, {
        size: tile.r * 0.95,
        color: TEXT_DARK,
        weight: '700',
      });
    }

    // Center display: the current assembled word, or a subtle placeholder.
    const display = this.currentInput ? this.currentInput.toUpperCase() : '';
    if (display) {
      // Size shrinks a bit as the word grows so it stays inside the ring.
      const maxW = this.ringRadius * 1.6;
      let size = Math.min(this.tileRadius * 1.4, 32);
      this.ctx.save();
      this.ctx.font = `700 ${size}px 'Inter', system-ui, sans-serif`;
      while (this.ctx.measureText(display).width > maxW && size > 12) {
        size -= 1;
        this.ctx.font = `700 ${size}px 'Inter', system-ui, sans-serif`;
      }
      this.ctx.restore();
      this.drawText(display, cx, cy, {
        size, color: PRIMARY_COLOR, weight: '700',
      });
    } else {
      this.drawText('Drag letters', cx, cy, {
        size: 13, color: TEXT_MUTED, weight: '500',
      });
    }
  }

  private renderButtons(): void {
    for (const btn of this.buttons) {
      const isSubmit = btn.label === 'submit';
      const fill = isSubmit ? BUTTON_COLOR : PANEL_COLOR;
      const textColor = isSubmit ? BUTTON_TEXT : TEXT_DARK;
      const stroke = isSubmit ? BUTTON_COLOR : BORDER_COLOR;
      this.drawRoundRect(btn.x, btn.y, btn.w, btn.h, 6, fill, stroke);

      const label = btn.label === 'submit' ? 'Submit'
                  : btn.label === 'shuffle' ? 'Shuffle'
                  : 'Clear';
      this.drawText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, {
        size: 14, color: textColor, weight: '700',
      });
    }
  }

  private renderFoundList(): void {
    const { x, y, w, h } = this.listRect;
    this.drawRoundRect(x, y, w, h, 6, PANEL_COLOR, BORDER_COLOR);

    if (this.foundWords.length === 0) {
      this.drawText('Found words appear here', x + w / 2, y + 22, {
        size: 12, color: TEXT_MUTED, weight: '500',
      });
      return;
    }

    // Two-column layout, fixed line height
    const lineH = 18;
    const colW = w / 2;
    const rowsPerCol = Math.max(1, Math.floor((h - 16) / lineH));
    // Show the most recent words first (newest on top)
    const display = [...this.foundWords].reverse();

    for (let i = 0; i < display.length; i++) {
      const col = Math.floor(i / rowsPerCol);
      const row = i % rowsPerCol;
      if (col >= 2) break; // overflow guard – drop the oldest off-screen entries
      const cellX = x + col * colW + 12;
      const cellY = y + 16 + row * lineH;
      const word = display[i];
      const isPangram = word === this.base;
      const color = isPangram ? SUCCESS_COLOR : TEXT_DARK;
      const weight = isPangram ? '700' : '600';
      this.drawText(word.toUpperCase(), cellX, cellY, {
        size: 12, color, weight, align: 'left',
      });
    }
  }

  private renderFlash(): void {
    if (!this.flash) return;
    const W = this.width;
    const H = this.height;
    // Float the flash just above the button row so it never occludes the ring.
    const cx = W / 2;
    const btnY = this.buttons.length > 0 ? this.buttons[0].y : H - 60;
    const cy = btnY - 12;
    if (cy < 0 || cy > H) return;
    this.drawText(this.flash.text, cx, cy, {
      size: 14, color: this.flash.color, weight: '700',
    });
  }

  // ── Input handling ──────────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;

    // Tile hit-test — if the pointer landed on a letter, start a drag session.
    const tileIdx = this.tileAt(x, y);
    if (tileIdx !== -1) {
      this.dragPointerX = x;
      this.dragPointerY = y;
      this.dragActive = true;
      this.isDragging = false;
      this.toggleTile(tileIdx);
      return;
    }

    // Otherwise, maybe the player hit a button.
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.handleButton(btn.label);
        return;
      }
    }
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.gameActive || !this.dragActive) return;
    this.dragPointerX = x;
    this.dragPointerY = y;

    const tileIdx = this.tileAt(x, y);
    if (tileIdx === -1) return;

    // Unselected tile under the pointer → extend the word.
    if (!this.selectedTiles.includes(tileIdx)) {
      this.selectedTiles.push(tileIdx);
      this.rebuildInputFromTiles();
      this.isDragging = true;
      this.haptic('light');
      return;
    }

    // Backtrack: if the pointer crosses back onto the previous tile, drop the
    // last letter. Word Connect behaviour — lets users undo without lifting.
    if (this.selectedTiles.length >= 2) {
      const prev = this.selectedTiles[this.selectedTiles.length - 2];
      if (prev === tileIdx) {
        this.selectedTiles.pop();
        this.rebuildInputFromTiles();
        this.isDragging = true;
        this.haptic('light');
      }
    }
  }

  protected handlePointerUp(_x: number, _y: number): void {
    if (!this.dragActive) return;
    const wasDragging = this.isDragging;
    this.dragActive = false;
    this.isDragging = false;

    // A real drag (pointer moved across at least two tiles) auto-submits on
    // release. A pure tap (down + up on the same tile with no movement) keeps
    // the letter selected so click-click mode still works.
    if (wasDragging && this.gameActive && this.currentInput.length > 0) {
      this.submitWord();
    }
  }

  /** Return the tile index at (x, y), or -1 if none. */
  private tileAt(x: number, y: number): number {
    for (const tile of this.tileRects) {
      const dx = x - tile.x;
      const dy = y - tile.y;
      // Slightly generous hit slop so fast drags don't slip between tiles.
      const hit = tile.r + 4;
      if (dx * dx + dy * dy <= hit * hit) {
        return tile.index;
      }
    }
    return -1;
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;

    if (key === 'Enter') {
      e.preventDefault();
      this.submitWord();
      return;
    }
    if (key === 'Escape') {
      e.preventDefault();
      this.clearInput();
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault();
      this.backspace();
      return;
    }

    // Single letter? Try to add it (case-insensitive).
    if (key.length === 1) {
      const lower = key.toLowerCase();
      if (lower >= 'a' && lower <= 'z') {
        // Find the first unused tile with this letter
        for (let i = 0; i < this.letters.length; i++) {
          if (this.letters[i] === lower && !this.selectedTiles.includes(i)) {
            this.toggleTile(i);
            return;
          }
        }
      }
    }
  }

  // ── Game actions ────────────────────────────────────────────────────────

  private toggleTile(index: number): void {
    if (index < 0 || index >= this.letters.length) return;

    const pos = this.selectedTiles.indexOf(index);
    if (pos >= 0) {
      // Already selected — remove it (and any after it, to keep the input
      // a strict prefix of selectedTiles).
      this.selectedTiles.splice(pos, this.selectedTiles.length - pos);
      this.rebuildInputFromTiles();
      this.haptic('light');
      return;
    }

    this.selectedTiles.push(index);
    this.rebuildInputFromTiles();
    this.haptic('light');
  }

  private rebuildInputFromTiles(): void {
    let s = '';
    for (const i of this.selectedTiles) {
      s += this.letters[i];
    }
    this.currentInput = s;
  }

  private backspace(): void {
    if (this.selectedTiles.length === 0) return;
    this.selectedTiles.pop();
    this.rebuildInputFromTiles();
  }

  private clearInput(): void {
    this.selectedTiles = [];
    this.currentInput = '';
  }

  private handleButton(label: 'submit' | 'shuffle' | 'clear'): void {
    if (label === 'submit') this.submitWord();
    else if (label === 'shuffle') this.shuffle();
    else this.clearInput();
  }

  private shuffle(): void {
    this.shuffleLetters();
    // After shuffle, the indices are stale — clear the selection.
    this.clearInput();
    this.haptic('medium');
  }

  /** Try to submit the current input as a word. Returns true if accepted. */
  private submitWord(): boolean {
    const word = this.currentInput.toLowerCase();
    if (word.length < 3) {
      this.setFlash('Too short', ERROR_COLOR);
      this.clearInput();
      return false;
    }
    if (this.foundWords.includes(word)) {
      this.setFlash('Already found', TEXT_MUTED);
      this.clearInput();
      return false;
    }
    if (!this.validWords.has(word)) {
      this.setFlash('Not a word', ERROR_COLOR);
      this.clearInput();
      this.haptic('medium');
      return false;
    }

    // Valid new word!
    this.foundWords.push(word);
    let gained = scoreForWord(word);
    if (word === this.base) {
      gained += PANGRAM_BONUS;
      this.foundPangram = true;
      this.setFlash('PANGRAM!', SUCCESS_COLOR);
      this.haptic('heavy');
    } else {
      this.setFlash(`+${gained}`, SUCCESS_COLOR);
      this.haptic('light');
    }
    this.addScore(gained);
    this.clearInput();

    this.checkWinCondition();
    return true;
  }

  private checkWinCondition(): void {
    if (this.won) return;
    if (this.foundWords.length < this.cfg.targetWords) return;
    if (this.cfg.requirePangram && !this.foundPangram) return;
    this.gameWin();
  }

  private setFlash(text: string, color: string): void {
    this.flash = { text, color, timeLeft: 1.2 };
  }

  // ── Save / Resume ─────────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      // Schema version lets future changes detect and migrate older snapshots.
      v: 2,
      base: this.base,
      letters: [...this.letters],
      foundWords: [...this.foundWords],
      foundPangram: this.foundPangram,
      timeLeft: this.timeLeft,
      gameActive: this.gameActive,
      difficulty: this.difficulty,
      // Radial layout state so the ring resumes in exactly the same spot.
      selectedTiles: [...this.selectedTiles],
      currentInput: this.currentInput,
    };
  }

  deserialize(state: GameSnapshot): void {
    const base = state.base as string | undefined;
    const letters = state.letters as string[] | undefined;
    if (typeof base !== 'string' || base.length === 0) return;
    if (!Array.isArray(letters) || letters.length === 0) return;
    if (letters.length !== this.cfg.letterCount) return;

    this.base = base;
    this.letters = [...letters];

    // Recompute valid words for this base (we don't trust serialized state).
    this.validWords = new Set();
    for (const word of DICTIONARY) {
      if (word.length < 3) continue;
      if (word.length > this.base.length) continue;
      if (!isMultisetSubset(word, this.base)) continue;
      this.validWords.add(word);
    }
    this.validWords.add(this.base);

    const found = state.foundWords;
    if (Array.isArray(found)) {
      this.foundWords = (found as unknown[]).filter((w): w is string => typeof w === 'string');
    } else {
      this.foundWords = [];
    }
    this.foundPangram = state.foundPangram === true;

    const tl = state.timeLeft;
    this.timeLeft = typeof tl === 'number' && tl > 0 ? tl : this.cfg.timeLimit;

    this.gameActive = state.gameActive !== false;

    // Radial state (v2+): restore in-flight word if present, else start clean.
    const selTiles = state.selectedTiles;
    if (Array.isArray(selTiles)) {
      const n = this.letters.length;
      this.selectedTiles = (selTiles as unknown[]).filter(
        (v): v is number => typeof v === 'number' && v >= 0 && v < n,
      );
    } else {
      this.selectedTiles = [];
    }
    const ci = state.currentInput;
    if (typeof ci === 'string') {
      this.currentInput = ci;
    } else {
      this.rebuildInputFromTiles();
    }

    // Tile positions depend on letter count; refresh them so hit-testing
    // works immediately after a resume without waiting for the next frame.
    this.computeTilePositions();
  }

  canSave(): boolean {
    return this.gameActive;
  }
}

// ── Registration ──────────────────────────────────────────────────────────

registerGame({
  id: 'anagram',
  name: 'Anagram',
  description: 'Form words from the letters',
  icon: 'A',
  color: '--color-primary',
  bgGradient: ['#D4A574', '#E8C497'],
  category: 'puzzle',
  createGame: (config) => new AnagramGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap letters to form words, Submit to check',
  dailyMode: true,
  continuableAfterWin: true,
});

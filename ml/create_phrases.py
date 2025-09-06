# Generate 10,000 phrases with MUCH greater sentence variety (and mixed capitalization for single words)
# Saves to: phrases_10000_varied_caps.csv
import random
import pandas as pd
from datetime import date, timedelta

random.seed(42)

# === Lexicons ===
adjs = [
    "bright","calm","curious","gentle","brisk","silent","vivid","crisp","bold","mellow",
    "faint","lively","cozy","swift","patient","eager","quirky","sleek","fuzzy","serene",
    "playful","witty","sturdy","nimble","lucid","subtle","zesty","radiant","tidy","brilliant",
    "sincere","cheerful","inventive","careful","graceful","daring","relaxed","spirited","candid","humble",
    "cosmic","rustic","urban","remote","tropical","arctic","sunny","misty","rainy","windy"
]

nouns = [
    "river","forest","city","notebook","idea","bridge","signal","garden","window","breeze",
    "story","circuit","planet","coffee","cloud","pattern","camera","compass","path","harbor",
    "sunrise","market","library","engine","canvas","ocean","lantern","satellite","valley","archive",
    "algorithm","prototype","network","dataset","model","console","router","ledger","sensor","battery",
    "runner","cyclist","traveler","friend","parent","teacher","student","artist","writer","builder"
]

people = ["Ava","Liam","Noah","Mia","Ethan","Zoe","Kai","Nina","Omar","Ivy","Sofia","Leo","Aria","Mason","Luna"]
places = [
    "on the hill","by the harbor","through the alley","under the old bridge","at the market",
    "near the library","along the coast","inside the workshop","across the valley","beneath the stars"
]

verbs_itv = [
    "wanders","glows","drifts","soars","flows","hums","shimmers","echoes","blooms","settles",
    "rises","falls","unfolds","sparks","links","guides","measures","connects","records","balances",
    "refreshes","inspires","surprises","comforts","adapts","expands","clarifies","illuminates","invites","anchors"
]

verbs_tv = [
    "find","build","paint","write","collect","measure","record","analyze","design","photograph",
    "calibrate","balance","organize","compare","predict","explore","assemble","repair","map","trace"
]

adverbs = [
    "softly","quietly","boldly","gently","slowly","brightly","calmly","firmly","lightly","gracefully",
    "curiously","eagerly","warmly","smoothly","openly","steadily","simply","surely","deeply","playfully"
]

timespans = [
    "at dawn","at dusk","all morning","every afternoon","late at night",
    "before sunrise","after the rain","on weekends","each day","once in a while"
]

hobbies = [
    "running","cycling","sketching","coding","baking",
    "gardening","photography","woodworking","swimming","reading"
]

connectors = ["and","but","so","because","while","although","therefore","however","meanwhile","instead"]

# === Helpers ===
def vary_capitalization(word: str) -> str:
    r = random.random()
    if r < 0.7:
        return word.lower()
    elif r < 0.9:
        return word.title()
    else:
        return word.upper()

def a_an(word: str) -> str:
    return ("an " if word[0].lower() in "aeiou" else "a ") + word

def rand_date():
    d = date.today() - timedelta(days=random.randint(0, 365*3))
    return d.strftime("%B %d, %Y")

def num(n1=1, n2=9999):
    return random.randint(n1, n2)

def list3(seq):
    a,b,c = random.sample(seq, 3)
    return f"{a}, {b}, and {c}"

# === Generators ===
def make_word(_):
    # Always single token (no hyphen), but with varied capitalization
    return vary_capitalization(random.choice(adjs + nouns))

def make_sentence(_):
    # A large and varied set of templates
    subj_n = random.choice(nouns)
    adj = random.choice(adjs)
    adv = random.choice(adverbs)
    pl = random.choice(places)
    pers = random.choice(people)
    hob = random.choice(hobbies)
    iv = random.choice(verbs_itv)
    tv = random.choice(verbs_tv)
    tspan = random.choice(timespans)

    templates = [
        lambda: f"The {adj} {subj_n} {iv} {pl} {tspan}.",
        lambda: f"I love {hob} because it feels {adj} {adv}.",
        lambda: f"{adj.capitalize()} ideas {iv} when the {subj_n} is quiet.",
        lambda: f"Remember to {random.choice(['breathe','hydrate','stretch','back up your files','take a break'])} {tspan}.",
        lambda: f"In {random.choice(['the city','the countryside','a small studio','a busy kitchen'])}, the {subj_n} {iv} {adv}.",
        lambda: f"Why does the {subj_n} seem so {adj} {tspan}?",
        lambda: f"{pers} {tv}s {a_an(adj + ' ' + subj_n)} {pl}.",
        lambda: f"On {rand_date()}, we noted that the {subj_n} {iv} {adv}.",
        lambda: f"{pers} asked, \"Can the {subj_n} really {iv}?\"",
        lambda: f"Please {tv} the {subj_n} {tspan}; it's {adj} {pl}.",
        lambda: f"{pers} {iv} {adv}, {connectors[0]} the {subj_n} stayed {adj}.",
        lambda: f"After {hob}, the {subj_n} {iv} as if it knew {pers}.",
        lambda: f"\"{adj.capitalize()} or not,\" {pers} said, \"the {subj_n} must {tv}.\"",
        lambda: f"The {subj_n} was {adj}—almost too {adj}—when {pers} arrived.",
        lambda: f"If the {subj_n} {iv} {adv}, {pers} will {tv} it.",
        lambda: f"Because the {subj_n} was {adj}, we decided to {tv} it {tspan}.",
        lambda: f"{pers} prefers {list3(hobbies)} on slow days.",
        lambda: f"Between {rand_date()} and {rand_date()}, the {subj_n} {iv} repeatedly.",
        lambda: f"Is the {subj_n} {adj} enough to {tv} safely?",
        lambda: f"Whenever it rains, the {subj_n} {iv} {pl}.",
        lambda: f"Nobody expected the {subj_n} to {iv} so {adv}.",
        lambda: f"Surprisingly, the {subj_n} {iv} while {pers} {tv}ed something else.",
        lambda: f"The plan was simple: {tv} the {subj_n}, review the results, and rest.",
        lambda: f"At exactly {num(1,12)}:{str(num(0,59)).zfill(2)}, the {subj_n} finally {iv}.",
        lambda: f"{pers} found {a_an(adj)} {subj_n} and called it \"Project {random.choice(['Aurora','Nimbus','Echo','Vega','Delta'])}\".",
        lambda: f"The {subj_n} (which was unusually {adj}) {iv} without warning.",
        lambda: f"First we {tv} the {subj_n}, then we {tv} the data, {connectors[-1]} we shared the report.",
        lambda: f"It was not just {a_an(adj)} {subj_n}; it was {a_an(random.choice(adjs))} revelation.",
        lambda: f"Most days the {subj_n} {iv} {tspan}, {connectors[1]} today it stalled.",
        lambda: f"Against expectations, {pers} kept the {subj_n} {adj} and steady.",
        lambda: f"The {subj_n} seems {adj}; still, we should {tv} it carefully.",
        lambda: f"From the {random.choice(['balcony','shore','ridge','window'])}, the {subj_n} {iv} like a memory.",
        lambda: f"Without a doubt, {pers} can {tv} {a_an(subj_n)} in minutes.",
        lambda: f"Let the {subj_n} {iv} {adv}, then begin to {tv}.",
        lambda: f"Statistically speaking, {num(5,95)}% of {subj_n}s {iv} {tspan}.",
        lambda: f"I keep wondering whether the {subj_n} will {iv} again tomorrow.",
        lambda: f"Only after {rand_date()} did we realize the {subj_n} was {adj}.",
        lambda: f"Notes: {list3([a_an(adj), a_an(random.choice(adjs)), a_an(random.choice(adjs))])}; status: {random.choice(['open','pending','closed'])}.",
        lambda: f"Short checklist: {tv} data; verify {subj_n}; document findings.",
        lambda: f"The {subj_n} {iv}, {connectors[2]} nobody noticed.",
        lambda: f"Had the {subj_n} {iv} earlier, {pers} might have left.",
        lambda: f"Some say the {subj_n} {iv} only {pl}.",
        lambda: f"Over time, the {subj_n} became more {adj} and less fragile.",
        lambda: f"By design, the {subj_n} {iv} when temperatures drop.",
        lambda: f"Could {pers} {tv} the {subj_n} before sunset?",
        lambda: f"After a pause, the {subj_n} resumed and {iv} twice.",
        lambda: f"The {subj_n} didn't {iv}; it waited.",
        lambda: f"To be fair, {pers} warned us the {subj_n} was {adj}.",
        lambda: f"Curiously, the {subj_n} {iv} exactly at noon.",
        lambda: f"Nothing about the {subj_n} felt {adj} until {pers} arrived.",
        lambda: f"In theory the {subj_n} should {iv}; in practice, it stalls.",
        lambda: f"With patience and light, the {subj_n} will {iv} again.",
        lambda: f"Tomorrow at {num(1,12)}:{str(num(0,59)).zfill(2)} {random.choice(['AM','PM'])}, we {tv} the {subj_n}.",
        lambda: f"Even {pers} admits the {subj_n} {iv} better {pl}.",
        lambda: f"The {subj_n} is {adj} enough to {tv} quietly.",
        lambda: f"Set the {subj_n} down, breathe, and watch it {iv}.",
        lambda: f"Oddly specific: {num(2,9)} samples, {num(10,99)} pages, 1 {subj_n}.",
        lambda: f"One step at a time, the {subj_n} will {iv} to completion.",
        lambda: f"Without {pers}, the {subj_n} rarely {iv} correctly.",
        lambda: f"At first glance, the {subj_n} looked {adj}—on closer look, still {adj}.",
    ]

    return random.choice(templates)()

def make_paragraph(_):
    s1 = make_sentence(_)
    s2 = (
        f"{random.choice(['Sometimes','Often','Now and then','From time to time']).capitalize()}, "
        f"{random.choice(['I notice','we find','people say','it seems'])} that the {random.choice(nouns)} "
        f"{random.choice(verbs_itv)} {random.choice(adverbs)} {random.choice(connectors)} the "
        f"{random.choice(nouns)} stays {random.choice(adjs)}."
    )
    s3 = f"On {date.today().isoformat()}, I wrote this down to remember that small details can be {random.choice(adjs)}."
    return " ".join([s1, s2]) if random.random() < 0.5 else " ".join([s1, s2, s3])

# === Build dataset ===
N_WORDS, N_SENT, N_PARA = 3000, 5000, 2000
phrases, types = [], []

for i in range(N_WORDS):
    phrases.append(make_word(i)); types.append("word")
for i in range(N_SENT):
    phrases.append(make_sentence(i)); types.append("sentence")
for i in range(N_PARA):
    phrases.append(make_paragraph(i)); types.append("paragraph")

combined = list(zip(types, phrases))
random.shuffle(combined)
types, phrases = zip(*combined)

df = pd.DataFrame({"type": types, "phrase": phrases})
df.to_csv("./phrases_10000.csv", index=False)

print("Saved to phrases_10000.csv")
print(df.head(10))

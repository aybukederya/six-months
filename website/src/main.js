import './style.css'

document.querySelector('#app').innerHTML = `
  <header class="hero">
    <nav>
      <span class="logo">THE SIX-MONTH EXPERIMENT</span>
      <span class="edition">VOL. 01 / 2026</span>
    </nav>

    <div class="hero-content">
      <p class="eyebrow">A PERSONAL DATA JOURNAL</p>

      <h1>
        Six months.<br />
      </h1>

      <p class="intro">
        Places traveled, money spent, steps taken, memories made and people met
      </p>

      <a href="#explore" class="explore">
        EXPLORE THE EXPERIMENT ↓
      </a>
    </div>
  </header>

  <main id="explore">
    <section class="chapter">
      <p class="eyebrow">CHAPTER 01</p>
      <h2>A life in motion.</h2>
      <p>
        Where I've been
      </p>

      <div class="placeholder">
        YOUR INTERACTIVE TRAVEL MAP GOES HERE
      </div>
    </section>

    <section class="chapter">
      <p class="eyebrow">CHAPTER 02</p>
      <h2>Money.</h2>
      <p>
        Money spent
      </p>
    </section>

    <section class="chapter">
      <p class="eyebrow">CHAPTER 03</p>
      <h2>Steps taken.</h2>
      <p>
        six months of movement,
        activity and everyday life.
      </p>
    </section>
  </main>

  <footer>
    A little less work. A lot more curiosity.
  </footer>
`

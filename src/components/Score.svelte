<script>
   export let time = 5;
   export let score = 0;
   export let appreciation = "";
   export let handle = "";

</script>

<style>
    .more {
        padding: 10px;
        text-align: center;
    }
    .message {
        font-size: 1.2em;
    }
    .info-container {
        margin-top: 10px;
    }
    .time, .score {
        font-size: 2em;
    }
    @media only screen and (max-width: 600px) {
        .time, .score {
            font-size: 1.5em
        }
    }
</style>

<div class="more">

  {#if !appreciation}<h1 class="message">{handle}</h1>
    {:else}
  <h1 class="message">{appreciation}</h1>{/if}

  <div class="info-container">
      <h1 class="time">Time left: {time}</h1>
      <h1 class="score">Score: {score}</h1>
  </div>

</div>
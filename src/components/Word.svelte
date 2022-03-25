<script>
  export let word = "";
</script>

<style>
   .word-container {
       text-align: center;
       margin-top: 40px;
       padding: 20px;
   }
   .word {
       font-size: 3.9em;
           
       
   }
   @media only screen and (max-width: 600px) {
       .word-container {
        margin-top: 60px;
        padding: 10px;
       }
       .word {
           font-size: 2em;
       }
   }
</style>

<div class="word-container">
    <h1 class="word">{word}</h1>
</div>
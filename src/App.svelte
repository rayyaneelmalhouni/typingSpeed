<script>
   import Word from "./components/Word.svelte";
   import Typer	from "./components/Typer.svelte";
   import Score from "./components/Score.svelte";
   import Notice from "./components/Notice.svelte";
</script>

<style>
   .container {
	   background-color: #5e5e5e;
	   min-height: 100vh;
	   width: 100%;
	   color: #F9F9F9;
	   
   }
   .title-container {
	   padding: 20px;
	   text-align: center;
	   background-color: #A9A9A9;
   }
   .title {
	   font-size: 1.7em;
   }
   @media only screen and (max-width: 600px) {
	   .title-container {
		   padding: 10px;
	   }
	   .title {
		   font-size: 1.3em;
	   }
   }
</style>
<div class="container">
<div class="title-container"><h1 class="title">Typing Speed</h1></div>
<Word />
<Typer />
<Score />
<Notice />
</div>
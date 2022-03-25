<style>
    .input {
        padding: 5px 10px;
        border: none;
        background-color: #A9A9A9;
        font-size: 2em;
        color: #5e5e5e;
        border-radius: 30px;
        text-align: center;
    }
    .input:focus {
        border:none;
        outline: none;
    }
    .input-container {
        display: flex;
        padding: 20px;
        margin-top: 20px;
        justify-content: center;
        
    }
    @media only screen and (max-width: 600px) {
        .input {
            font-size: 1.3em;
            border-radius: 30px;
            width: 70%;
            padding: 10px 10px;
        }
    }
</style>

<div class="input-container" ><input placeholder="Type..." spellcheck="false" class="input"  name="input" id="input"></div>
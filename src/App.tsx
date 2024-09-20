import React, { useState, createContext, useContext } from 'react';
import Select from 'react-select';
import './App.css';

type Options = {
  showEvents: boolean;
}

type Data = {
  items: Item[],
  recipes: Recipe[]
}

const END_RESOURCES = [
  "Desc_OreIron_C",
  "Desc_OreCopper_C",
  "Desc_OreGold_C",
  "Desc_RawQuartz_C",
  "Desc_OreUranium_C",
  "Desc_LiquidOil_C",
  "Desc_Stone_C",
  "Desc_Coal_C",
  "Desc_SAM_C",
  "Desc_Water_C",
  "Desc_HeavyOilResidue_C",
]

const emptyData = {
  items: [],
  recipes: [],
}

const defaultOptions: Options = {showEvents: false};

const OptionContext = createContext<Options>(defaultOptions);
const DataContext = createContext<Data>(emptyData);

function App() {
  const [options, setOptions] = useState<Options>(defaultOptions);
  const [data, setData] = useState<Data>(emptyData);

  if (data.items.length == 0) {
    let itemJson: any[] = require('./items.json');
    data.items = itemJson.map(item => new Item(item)).sort((a, b) => a.name.localeCompare(b.name));
    setData(data);
  }

  if (data.recipes.length == 0) {
    let recipeJson: any[] = require('./recipes.json');
    data.recipes = recipeJson.filter(x => x.mProducedIn != "" && !x.mProducedIn.includes("BuildGun") && !x.FullName.match(/ResourceConversion|Unpackage/)).map(x => new Recipe(x)).filter(x => x.machines.length > 0);
    setData(data);
  }

  return (
    <div className="App">
      <main>
        <OptionBox options={options} setOptions={setOptions}></OptionBox>
        <hr></hr>
        <DataContext.Provider value={data}>
          <OptionContext.Provider value={options}>
            <Targets></Targets>
          </OptionContext.Provider>
        </DataContext.Provider>
      </main>
    </div>
  );
}

class Machine {
  id: string = "";
  name: string = "[Unknown Machine]";
  constructor(data: string) {
    let match = data;
    if (match == null) return;
    this.id = match;
    if (this.id.match(/ConstructorMk1/)) this.name = "Constructor";
    if (this.id.match(/AssemblerMk1/)) this.name = "Assembler";
    if (this.id.match(/ManufacturerMk1/)) this.name = "Manufacturer";
    if (this.id.match(/Refinery/)) this.name = "Refinery";
    if (this.id.match(/Packager/)) this.name = "Packager";
    if (this.id.match(/Smelter/)) this.name = "Smelter";
    if (this.id.match(/Foundry/)) this.name = "Foundry";
  }
}

class Item {
  id: string;
  name: string;
  description: string;
  isEvent: boolean;

  constructor(data: any) {
    this.id = data.ClassName;
    this.name = data.mDisplayName;
    this.description = data.mDescription;
    this.isEvent = data.mSmallIcon.includes("/Events/");
  }
}

class Ingredient {
  id: string = "";
  amount: number = 0;
  constructor(data: string) {
    let match = data.match(/\(ItemClass=".+'.+\.(?<id>Desc_.+?_C)'",Amount=(?<amount>[\d.]+)\)/)?.groups;
    if (!match) return;
    this.id = match.id;
    this.amount = parseInt(match.amount);
  }
}

class Recipe {
  id: string;
  recipeName: string;
  ingredients: Ingredient[];
  products: Ingredient[];
  machines: Machine[];
  duration: number;
  isEvent: boolean;

  constructor(obj: any) {
    this.id = obj.ClassName;
    this.recipeName = obj.mDisplayName;
    this.ingredients = this.parseIngredients(obj.mIngredients);
    this.products = this.parseIngredients(obj.mProduct);
    this.machines = this.parseList(obj.mProducedIn).filter(x => !x.includes("WorkBench")).map(x => new Machine(x));
    this.duration = parseFloat(obj.mManufactoringDuration);
    this.isEvent = obj.mRelevantEvents != "";
  }

  hasProduct(id: string | undefined): boolean {
    return id != undefined && this.products.find(product => product.id == id) != undefined;
  }

  parseIngredients(obj: any): Ingredient[] {
    return Array.from(obj.matchAll(/(\(ItemClass=.+?\))/g), (x: string) => new Ingredient(x[0]));
  }
  
  parseList(obj: any) {
    return Array.from(obj.matchAll(/"(.+?)"/g), (x: string) => x[0]);
  }
}

interface ItemInputParams { onChange: (item: string) => void, rate: number, onRateChange: (rate: number) => void }
function ItemInput({ onChange, rate, onRateChange }: ItemInputParams) {
  const [selectedOption, setSelectedOption] = useState<null | any>();
  const options = useContext(OptionContext);
  const data = useContext(DataContext);
  const selectOptions = data.items
    .filter(item => !item.isEvent || options.showEvents)
    .map(item => ({ value: item.id, label: item.name }));

  function onValueChange(option: any) {
    setSelectedOption(option);
    onChange(option.value);
  }

  return (
    <div>
    <Select
    defaultValue={selectedOption}
    onChange={onValueChange}
    options={selectOptions} />
    </div>
  )
}

interface RecipeInputParams { recipes: any[], selectedRecipe: any, onRecipeChange: any };
function RecipeInput({recipes, selectedRecipe, onRecipeChange } : RecipeInputParams) {

  return (
    <Select
      value={selectedRecipe}
      onChange={onRecipeChange}
      options={recipes} />
  )
}

function round(num: number, places: number = 4) {
  const pow = Math.pow(10, places);
  return Math.round(num * pow) / pow;
}

interface OptionParams {
  options: Options,
  setOptions: (options: Options) => void
}

function OptionBox({ options, setOptions }: OptionParams) {
  return (
    <div className="options">
    <h2>Satisfactory Recipe Calculator</h2>
    <Checkbox name="showEvents" label="Show Event Items" value={options.showEvents} onChange={checked => setOptions({...options, showEvents: checked})}></Checkbox>
    </div>
  )
}

interface CheckboxParams { name: string, label: string, value: boolean, onChange: (value: boolean) => void }
function Checkbox({ name, label, value, onChange }: CheckboxParams) {
  return (
    <div>
      {label} <input type="checkbox" name={name} checked={value} onChange={e => onChange(e.target.checked)}></input>
    </div>
  )
}

function getItem(data: Data, id: string) {
  return data.items.find(item => item.id == id);
}

function RecipeList({recipe, multiplier} : {recipe: Recipe, multiplier: number}) {
  const data = useContext(DataContext);

  return (
    <div className="recipe-list">
      {recipe.ingredients.map(ingredient => 
        <div key={multiplier + "x" + (ingredient.amount / recipe.duration * 60) + "-" + ingredient.id} className="recipe-ingredient">
        {END_RESOURCES.includes(ingredient.id) && <div className="raw">Need {round(multiplier * ingredient.amount / recipe.duration * 60)}/m of {getItem(data, ingredient.id)?.name}</div>}
        {!END_RESOURCES.includes(ingredient.id) && <Target defaultTarget={ingredient.id} defaultTargetRate={(multiplier * ingredient.amount/recipe.duration) * 60}></Target>}</div>)}
    </div>
  );
}
// 

function Target({defaultTarget, defaultTargetRate} : {defaultTarget: null | string, defaultTargetRate: number | null}) {
  const [target, setTarget] = useState<string | null>(defaultTarget);
  const [recipe, setRecipe] = useState<Recipe>();
  const [targetRate, setTargetRate] = useState<number>(defaultTargetRate ?? 1);
  let [selectedOption, setSelectedOption] = useState<any>();
  const data = useContext(DataContext);
  const options = useContext(OptionContext);

  if (defaultTarget != null && selectedOption == null) {
    let recipes = filterRecipes(defaultTarget);
    if (recipes.length > 0) {
      var nonAlt = recipes.find(recipe => !recipe.label.match(/Alternate/))
      selectedOption = nonAlt ?? recipes[0];
      onRecipeChange(selectedOption);
    }
  }

  function filterRecipes(target: string) {
    return data.recipes
      .filter(recipe => recipe.hasProduct(target) && (!recipe.isEvent || options.showEvents))
      .map(recipe => ({ value: recipe.id, label: recipe.recipeName }))
  }
  
  function onItemChange(value: string) {
    setTarget(value);
    let recipes = filterRecipes(value);
    if (recipes.length > 0) {
      selectedOption = recipes[0];
      onRecipeChange(selectedOption);
    }
  }

  function onRateChange(rate: number) {
    if (isNaN(rate)) rate = targetRate;
    setTargetRate(rate);
  }

  function onRecipeChange(value: any) {
    setSelectedOption(value);
    const foundRecipe = data.recipes.find(recipe => recipe.id == value.value);
    if (foundRecipe) {
      if (defaultTargetRate == null)
        setTargetRate(foundRecipe.products[0].amount / foundRecipe.duration * 60)
      setRecipe(foundRecipe);
    }
  }

  function roundUp() {
    if (!target || !recipe) return;
    let currentMult = targetRate/(recipe.products[0].amount/recipe.duration*60);
    let newMult = Math.ceil(currentMult);
    setTargetRate(newMult * (recipe.products[0].amount/recipe.duration*60));
  }

  return (
    <div className="target">
      {target && recipe && defaultTarget != null && <div>Need {round(targetRate, 4)}/m {getItem(data, target)?.name}</div>}
      {defaultTarget == null && "Target Item: "}
      <div className="item-target">
        {defaultTarget == null && (
          <>
          <ItemInput onChange={onItemChange} rate={targetRate} onRateChange={onRateChange}></ItemInput>
          <input type="number" value={targetRate} onChange={e => onRateChange(parseFloat(e.target.value))}></input>
          <span className="items-per-minute">items / min</span>
          </>)}
      </div>
    <div className="item-target">
      {target && <RecipeInput recipes={filterRecipes(target)} onRecipeChange={onRecipeChange} selectedRecipe={selectedOption}></RecipeInput>}
        {defaultTarget != null && (
          <>
          <input type="number" value={targetRate} onChange={e => onRateChange(parseFloat(e.target.value))}></input>
          <span className="items-per-minute">items / min</span>
          </>)}
    </div>
      {target && recipe && <div>Using {round(targetRate/(recipe.products[0].amount/recipe.duration*60))}x {recipe.machines[0].name} with {round(recipe.products[0].amount/recipe.duration*60)}/m</div>}
      {target && recipe && <button onClick={roundUp}>Round Up</button>}
      {target && recipe && defaultTargetRate && defaultTargetRate < targetRate && <div className="extra">Producing {targetRate - defaultTargetRate}/m extra!</div>}
      {target && recipe && defaultTargetRate && defaultTargetRate > targetRate && <div className="less">Producing {targetRate - defaultTargetRate}/m less than required!</div>}
      {target && recipe && <RecipeList recipe={recipe} multiplier={(targetRate/(recipe.products[0].amount/recipe.duration*60))}></RecipeList>}
    </div>
  )
}

function Targets() {
  return (
    <Target defaultTarget={null} defaultTargetRate={null}></Target>
  );
}

export default App;

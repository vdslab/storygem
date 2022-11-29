import { useState } from "react";

//https://www.japantimes.co.jp/news/2022/11/28/national/english-speaking-test/ のニュース
const defaultText = "The Tokyo Metropolitan Board of Education on Sunday held its first English speaking test, part of the entrance examinations for metropolitan high schools. About 69,000 applicants, mainly students of public junior high schools in the capital, took the test, introduced in hopes of developing globally competitive human resources. At Hibiya High School, one of the 197 test sites, seemingly nervous junior high school third-year students were entering the building. In the 15-minute test, examinees spoke into a microphone to answer questions displayed on a tablet device. The number of applicants reached 76,000 for only students of public junior high schools, but many of them were absent or arrived late. The education board plans to hold a makeup test Dec. 18. There have been no reports of major problems, such as equipment failure, according to the board. The test was administered by educational service provider Benesse. About 670 employees of the education board were dispatched to exam sites. The results will be disclosed to exam takers online on Jan. 12. Tokyo is the first local government that has uniformly introduced an English test administered by a private organization to local public high school entrance examinations. The English speaking test has drawn opposition partly because it excludes students of national and private junior high schools. Critics also say that the grading method is not fair or transparent. Some residents have filed a lawsuit to stop public funds from being spent on the test.";

const Form = () => {
    let text = defaultText;
    const [data,setData] = useState([]);
    const makeData = (e) =>{
        text = e.target.elements.text.value;
        const originalText = text.replace(/,/g, ' ').replace(/\./g, ' ');
        const temp_word_list = originalText.split(' ');
        const word_list = [];
        for(let word of temp_word_list){
            if(word !== ""){
                word_list.push(word);
            }
        }
        setData(word_list);
        console.log(data);
    }
    return(
      <section className="section">
        <div className="container">
            <div className="field">
                <form onSubmit={(event)=>{
                    event.preventDefault();
                    makeData(event);
                }}
                >
                    <label className="label">Input Text</label>
                    <div className="control">
                        <textarea
                            name="text"
                            className="textarea"
                            defaultValue={defaultText}
                        />
                        <button className="button is-dark" type="submit">
                            結果を見る
                        </button>
                    </div>
                </form>
            </div>
        </div>
        <p>{text}</p>
        <p>{data}</p>
        <p>{"単語数"+data.length}</p>
      </section>
    );
}

export default Form;
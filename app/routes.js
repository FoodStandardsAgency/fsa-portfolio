var express 			= require('express');
var { check } 		= require('express-validator');
const _ 				= require('lodash');
const multer			= require('multer');
const jwt 				= require('jsonwebtoken');
const xss				= require('xss');
const stringify 		= require('csv-stringify')

// Custom modules
const config 			= require('./config');
var queries 			= require('./queries');

const add_project 		= require('./render_add_project');
const update_portfolio 	= require('./update_portfolio');
const delete_portfolio	= require('./delete_portfolio');
const update_odd 		= require('./update_odd');
const handle_form 		= require('./handle_add_update');
const handle_delete		= require('./handle_delete');
const bulk				= require('./bulk');
const login 			= require('./login');
const filter_view 		= require('./filter_view');
const project_view 		= require('./project_view');
const odd_view			= require('./oddleads_view');

var router = express.Router();
const backend = require('./backend');


// Add timestamps to logs
require('log-timestamp');
console.log("User entry (timestamp 1hr behind)");

// Prep data for summary views
function nestedGroupBy(data, keys) {
  var grouped = {};
  data.forEach((item) => {
    _.update(grouped,
      keys.map((k) => item[k]).join('.'),
      (val) => val ? (val.push(item), val) : [item]
    );
  });
  
 return grouped;
}



//-------------------------------------------------------------------
// LOGIN PAGE
//-------------------------------------------------------------------

router.get ('/login', function (req, res) {res.render("login");});
router.post('/login', [check('user').escape()], function (req, res) { login.login(req, res); });

router.get('/log-out', (req, res) => {
	// Destroy session and log out
	req.session.destroy(function (err) {
		req.logout();
		res.redirect('/login');
	});
});


//-------------------------------------------------------------------
// PORTFOLIO LANDING PAGE
//-------------------------------------------------------------------

router.get('/', login.requireLogin, async (req, res) => {
	
	// run query to pick up all portfolios we have on the platform - and feed through to the template
	// Put expected data structure here. [[url,acronym,name],[...], [...]]
	var portfolios = [['odd', 'ODD','Openness, Data and Digital'], ['serd', 'SERD', 'Science, Evidence and Reseach Directorate'],['abc', 'ABC', 'Portfolio name'], ['test1', 'Test1', 'Portfolio name'],  ['test2', 'Test2', 'Portfolio name'],  ['test3', 'Test3', 'Portfolio name'],  ['test4', 'Test4', 'Portfolio name']]
	
	res.render('landing', {
		"data":portfolios,
		"sess": req.session
	});
})


//-------------------------------------------------------------------
// CONFIGURATION
//-------------------------------------------------------------------

router.get('/:portfolio/configure', login.requireLogin, async (req, res) => {
	
	// Need to get current configuration data to pre-populate the form

	var portfolio = req.params.portfolio;
		
	res.render('configure', {
		"data":"",
		"sess": req.session,
		"portfolio": portfolio
	});
})



//-------------------------------------------------------------------
// SUMMARY PAGES
//-------------------------------------------------------------------

router.get('/:portfolio', login.requireLogin, async (req, res) => {
	var portfolio = req.params.portfolio;
	queries.current_projects(portfolio)
	.then((result) => {
		res.render('summary', {
			"data": nestedGroupBy(result.body, ['category', 'phase']),
			"counts": _.countBy(result.body, 'phase'),
			"themes": config.categories,
			"phases": config.phases,
			"sess": req.session,
			"portfolio": portfolio
		});
	})
	.catch();
});


router.get('/:portfolio/priority/', login.requireLogin, function (req, res) {	
	var portfolio = req.params.portfolio;
	queries.current_projects(portfolio)
	.then((result) => {
		res.render('summary', {
			"data": nestedGroupBy(result.body, ['pgroup', 'phase']),
			"counts": _.countBy(result.body, 'phase'),
			"themes": config.priorities,
			"phases":config.phases,
			"sess": req.session,
			"portfolio": portfolio
		});
	});	
});

router.get('/:portfolio/team/', login.requireLogin, function (req, res) {	
	var portfolio = req.params.portfolio;
	queries.current_projects(portfolio)
	.then((result) => {
		res.render('summary', {
			"data": nestedGroupBy(result.body, ['g6team', 'phase']),
			"counts": _.countBy(result.body, 'phase'),
			"themes": config.teams,
			"phases":config.phases,
			"sess": req.session,
			"portfolio": portfolio
		});
	});	
});

router.get('/:portfolio/rag/', login.requireLogin, function (req, res) {
	var portfolio = req.params.portfolio;
	queries.current_projects(portfolio)
	.then((result) => {
		  res.render('summary', {
			"data": 	nestedGroupBy(result.body, ['rag', 'phase']),
			  "counts": _.countBy(result.body, 'phase'),
			"themes": 	config.rags,
			"phases":	config.phases,
			"sess": req.session,
			"portfolio": portfolio
		});
	});	
});

router.get('/:portfolio/oddlead/', login.requireLogin, function (req, res) {odd_view(req, res);});

router.get('/:portfolio/status/', login.requireLogin, function (req, res) {
	var portfolio = req.params.portfolio;
	queries.current_projects(portfolio)
	.then((result) => {
		res.render('phaseview', {
			"data": nestedGroupBy(result.body, ['phase']),
			"counts": _.countBy(result.body, 'phase'),
			"phases":	config.phases,
			"sess": req.session,
			"portfolio": portfolio
		});
	})
	.catch();	
});

router.get('/:portfolio/new_projects/', login.requireLogin, function (req, res) {	
	queries.new_projects()
	.then((result) => {
		res.render('summary', {
			"data": nestedGroupBy(result.body, ['g6team', 'phase']),
			"counts": _.countBy(result.body, 'phase'),
			"themes": config.teams,
			"phases":config.phases,
			"sess": req.session,
			"portfolio": portfolio
		});
	});	
});

router.get('/:portfolio/archived', login.requireLogin, function (req, res) {
	queries.completed_projects()
	.then((result) => {
		res.render('completed', {
			"user": req.session.user,
			"data": result.body,
			"counts": _.countBy(result.body, 'phase'),
			"sess":req.session,
			"portfolio": portfolio
		});
	})
	.catch();	
});

router.get('/:portfolio/completed', login.requireLogin, function (req, res){res.redirect('/archived');});

router.get('/:portfolio/portfolio-team', login.requireLogin, (req, res) => {
	if(req.session.user == 'portfolio') {res.render('team-page', {"sess": req.session});}
	else {res.render('error_page', {message: 'You are not authorised to view this page'});}
});
		
	
//-------------------------------------------------------------------
// FILTER VIEW
//-------------------------------------------------------------------

router.get ('/filter-view', login.requireLogin, function (req,res) {res.render('filter_view', {"sess": req.session});});
router.post('/filter-view', login.requireLogin, function (req,res) {filter_view(req,res)});

//-------------------------------------------------------------------
// PROJECT VIEW
//-------------------------------------------------------------------

router.get('/projects/:project_id', login.requireLogin, async function (req, res) {project_view(req, res);});

//-------------------------------------------------------------------
// RENDER FORMS
//-------------------------------------------------------------------
router.get('/:portfolio/add', login.requireLogin, function (req, res) {
	
	var portfolio = req.params.portfolio
	
	if(req.session.user == 'portfolio') {
			
		var config = JSON.parse('{"inc":["id1", "id2", "ab_name", "ab_desc", "ab_theme", "ab_cat", "ab_scat", "ab_dir", "ab_chan", "ab_rel", "ab_doc"], "adm":["id2", "ab_name", "ab_desc"], "lab":{"ab_name":"Project title"}, "val":{"ab_risk":["low", "medium", "high"], "ab_cat":["category 1", "category 2", "category 3"], "ab_scat":["secondary category 1", "secondary category 2", "secondary category 3"]}}');
		
		res.render('add-edit-project', {
			"user": req.session.user, // need access-level to determine whether user can add projects
			"data": '',
			"config":config,
			"sess":req.session,
			"portfolio": portfolio
		});
		
		//add_project(req,res);
		}
	else {res.render('error_page', {message: 'You are not authorised to view this page'});}
});

router.get('/:portfolio/edit/:project_id', login.requireLogin, function (req, res) {
	if(req.session.user == 'portfolio'){update_portfolio(req, res);}
	else {res.render('error_page', {message: 'You are not authorised to view this page'});}
});


		
router.get('/portfolio-update/:project_id', login.requireLogin, async function (req, res) {
	if (req.session.user == 'portfolio') {
		await update_portfolio(req, res);
	}
	else {res.render('error_page', {message: 'You are not authorised to view this page'});}
});

router.get('/portfolio-delete/:project_id', login.requireLogin, function (req, res) {
	if(req.session.user == 'portfolio'){delete_portfolio(req, res);}
	else {res.render('error_page', {message: 'You are not authorised to view this page'})};
});

router.get('/odd-update/:project_id', login.requireLogin, (req, res) => {
	if(req.session.user == 'portfolio' || req.session.user == 'odd' || req.session.user == 'team_leaders'){update_odd(req, res);}
	else {res.render('error_page', {message: 'You are not authorised to view this page'});}
});

//-------------------------------------------------------------------
// ADD/UPDATE PROJECTS - handle form submissions
//-------------------------------------------------------------------
router.post('/process-project-form', login.requireLogin, async function (req, res) { handle_form(req, res); });
	
//-------------------------------------------------------------------
// DELETE PROJECTS - handle form submissions
//-------------------------------------------------------------------	
router.post('/delete_project_process', login.requireLogin, function (req, res) {handle_delete(req, res)});


//-------------------------------------------------------------------
// Export latest projects as a csv
//-------------------------------------------------------------------	

router.get('/download/csv', login.requireLogin, function(req,res){

	if(req.session.user == 'portfolio') {
		queries.latest_projects()
		.then( (result) => {
						
			for (i = 0; i < result.body.length; i++){
			/*Project size*/
			if(result.body[i].project_size == 's') {result.body[i].project_size = 'Small'}
			else if(result.body[i].project_size == 'm') {result.body[i].project_size = 'Medium'}
			else if(result.body[i].project_size == 'l') {result.body[i].project_size = 'Large'}
			else if(result.body[i].project_size == 'x') {result.body[i].project_size = 'Extra Large'}
			else {result.body[i].project_size = 'Not set'}
			
			/*Phase*/
			if(result.body[i].phase == 'backlog') 	{result.body[i].phase = 'Backlog'}
			else if(result.body[i].phase == 'discovery') {result.body[i].phase = 'Discovery'}
			else if(result.body[i].phase == 'alpha') 	{result.body[i].phase = 'Alpha'}
			else if(result.body[i].phase == 'beta') 		{result.body[i].phase = 'Beta'}
			else if(result.body[i].phase == 'live') 		{result.body[i].phase = 'Live'}
			else if(result.body[i].phase == 'completed') {result.body[i].phase = 'Completed'}
			else {result.body[i].phase = 'Not set'}
			
			/*Category*/
			if(result.body[i].category == 'cap') 	{result.body[i].category = 'Developing our digital capability'}
			else if(result.body[i].category == 'data')	{result.body[i].category = 'Data driven FSA'}
			else if(result.body[i].category == 'sm') 	{result.body[i].category = 'IT Service management'}
			else if(result.body[i].category == 'ser') 	{result.body[i].category = 'Digital services development and support'}
			else if(result.body[i].category == 'it') 	{result.body[i].category = 'Evergreen IT'}
			else if(result.body[i].category == 'res') 	{result.body[i].category = 'Protecting data and business resilience'}
			else {result.body[i].category = 'Not set'}
				
			/*Budget*/
			if(result.body[i].budgettype == 'admin') 	{result.body[i].budgettype = 'Admin'}
			else if(result.body[i].budgettype == 'progr') 	{result.body[i].budgettype = 'Programme'}
			else if(result.body[i].budgettype == 'capit') 	{result.body[i].budgettype = 'Capital'}
			else {result.body[i].budgettype = 'Not set'}
			
			/*Directorate*/
			if(result.body[i].direct == 'ODD') 	{result.body[i].direct = 'Openness Data & Digital'}
			else if(result.body[i].direct == 'COMMS') 	{result.body[i].direct = 'Communications'}
			else if(result.body[i].direct == 'IR') 	{result.body[i].direct = 'Incidents & Resilience'}
			else if(result.body[i].direct == 'FO') 	{result.body[i].direct = 'Field Operations'}
			else if(result.body[i].direct == 'FP') 	{result.body[i].direct = 'Finance & Performance'}
			else if(result.body[i].direct == 'FSP') 	{result.body[i].direct = 'Food Safety Policy'}
			else if(result.body[i].direct == 'FSA') 	{result.body[i].direct = 'FSA Wide'}
			else if(result.body[i].direct == 'NFCU') 	{result.body[i].direct = 'National Food Crime Unit'}
			else if(result.body[i].direct == 'NI') 	{result.body[i].direct = 'Northern Ireland'}
			else if(result.body[i].direct == 'PEOP') 	{result.body[i].direct = 'People'}
			else if(result.body[i].direct == 'RC') 	{result.body[i].direct = 'Regulatory Compliance'}
			else if(result.body[i].direct == 'SERD') 	{result.body[i].direct = 'Science Evidence & Research'}
			else if(result.body[i].direct == 'SLG') 	{result.body[i].direct = 'Strategy Legal & Governance'}
			else if(result.body[i].direct == 'WAL') 	{result.body[i].direct = 'Wales'}
			else {result.body[i].direct = 'Not set'}	
			
			/*RAG*/
			if(result.body[i].rag == 'gre') {result.body[i].rag = 'Green'}
			else if(result.body[i].rag == 'nor') {result.body[i].rag = 'Not set'}
			else if(result.body[i].rag == 'amb') {result.body[i].rag = 'Amber'}
			else if(result.body[i].rag == 'red') {result.body[i].rag = 'Red'}
			else {result.body[i].rag = 'Not set'}
			}

		  res.setHeader('Content-Type', 'text/csv');
		  res.setHeader('Content-Disposition', 'attachment; filename=\"' + 'latest_projects-' + Date.now() + '.csv\"');
		  res.setHeader('Cache-Control', 'no-cache');
		  res.setHeader('Pragma', 'no-cache');

		  stringify(result.body, { header: true })
			.pipe(res);

		})
		.catch();
	}
	else {res.render('error_page', {message: 'You are not authorised to view this page'});}
})




	


//-------------------------------------------------------------------
// Export router
//-------------------------------------------------------------------

module.exports = router;
